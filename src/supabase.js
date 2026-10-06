// Client Supabase và mọi truy vấn. Bảng reviews có quyền theo cột: luôn liệt kê cột, không select=*.
import { createClient } from '@supabase/supabase-js'

// Chưa cấu hình Supabase (vd bản GitHub Pages đầu tiên) thì app vẫn mở được: bản đồ và địa danh chạy,
// danh sách quán hiện thông báo không tải được
export const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://chua-cau-hinh.invalid',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'chua-cau-hinh', {
  auth: { flowType: 'pkce' },
})

const PLACE_COLS = 'id,google_place_id,name,category,lat,lng,address,area_id,price_min,price_max,opening_hours,suggested_by_name,review_count,avg_stars,price_count,price_median,price_p25,price_p75,top_dishes,cover_path,cover_at'
const CACHE = 'qq:places:v1'

const must = ({ data, error }) => {
  if (error) throw error
  return data
}

export function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE)) } catch { return null }
}

// Lấy quán và cụm trường, lưu lại để lần sau vẽ ngay và để xem được khi Supabase lỗi.
export async function fetchPlaces() {
  const [places, areas] = await Promise.all([
    sb.from('places_public').select(PLACE_COLS).then(must),
    sb.from('areas').select('id,name,center_lat,center_lng,radius_m').order('id').then(must),
  ])
  const data = { places, areas, savedAt: new Date().toISOString() }
  try { localStorage.setItem(CACHE, JSON.stringify(data)) } catch {}
  return data
}

export const fetchReviews = placeId =>
  sb.from('reviews_public')
    .select('id,stars,price_paid,dishes,comment,is_sample,review_date,created_at,display_name,author_review_count')
    .eq('place_id', placeId).order('created_at', { ascending: false }).limit(20).then(must)

// RLS trả ảnh đang hiện và ảnh của chính mình (kể cả đang chờ duyệt)
export const fetchPhotos = placeId =>
  sb.from('photos').select('id,review_id,storage_path,width,height,status,created_at')
    .eq('place_id', placeId).neq('status', 'hidden')
    .order('created_at', { ascending: false }).limit(30).then(must)

export const photoUrl = path => sb.storage.from('photos').getPublicUrl(path).data.publicUrl
export const thumbPath = path => path.replace(/(\.\w+)$/, '_t$1')

export const submitReview = args => sb.rpc('submit_review', args).then(must)

// Thử lại sau lỗi mạng thì file hoặc dòng có thể đã lên từ lần trước: coi "đã tồn tại" là thành công.
const okIfExists = ({ error }) => {
  if (error && !(String(error.statusCode) === '409' || error.code === '23505' || /exists/i.test(error.message))) throw error
}

export async function uploadPhoto(userId, reviewId, placeId, n, big, thumb) {
  const ext = big.blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${reviewId}/${n}.${ext}`
  const put = (p, img) => sb.storage.from('photos').upload(p, img.blob, { cacheControl: '31536000', contentType: img.blob.type })
  okIfExists(await put(path, big))
  okIfExists(await put(thumbPath(path), thumb))
  okIfExists(await sb.from('photos').insert({ review_id: reviewId, place_id: placeId, storage_path: path, width: big.width, height: big.height }))
}

// supabase-js insert không kèm .select() nên không cần quyền đọc bảng reports
export const report = (targetType, targetId, reason) =>
  sb.from('reports').insert({ target_type: targetType, target_id: targetId, reason }).then(must)

export const suggestPlace = row => sb.from('places').insert(row).then(must)

export const myProfile = uid => sb.from('profiles').select('display_name').eq('id', uid).single().then(must)

export const updateName = (uid, name) => sb.from('profiles').update({ display_name: name }).eq('id', uid).then(must)

export const myReviews = uid =>
  sb.from('reviews').select('id,place_id,stars,price_paid,comment,status,review_date,places(name)')
    .eq('user_id', uid).order('created_at', { ascending: false }).then(must)

export const mySuggestions = uid =>
  sb.from('places').select('id,name,status,created_at').eq('created_by', uid).neq('status', 'visible')
    .order('created_at', { ascending: false }).then(must)

async function removeFolder(prefix) {
  const files = must(await sb.storage.from('photos').list(prefix, { limit: 100 }))
  const paths = files.filter(f => f.id).map(f => `${prefix}/${f.name}`)
  if (paths.length) must(await sb.storage.from('photos').remove(paths))
  return files.filter(f => !f.id).map(f => `${prefix}/${f.name}`) // thư mục con
}

// Xóa file trước: cascade trong database không xóa được file trong Storage
export async function deleteReview(uid, reviewId) {
  await removeFolder(`${uid}/${reviewId}`)
  must(await sb.from('reviews').delete().eq('id', reviewId))
}

export async function deleteAccount(uid) {
  for (const dir of await removeFolder(uid)) await removeFolder(dir)
  must(await sb.rpc('delete_account'))
}
