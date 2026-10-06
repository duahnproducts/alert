// Trang chi tiết quán: ảnh, giá thật, điểm của app, link sang Google Maps, đánh giá, báo cáo; trang chỉ đường trong app.
import { DEMO, demoData, fetchReviews, fetchPhotos, photoUrl, thumbPath, report } from './supabase.js'
import { CATEGORIES, h, hoursText, isOpenNow, formatPrice, formatStars, formatDistance, badgeFor, timeAgo, formatDate, priceShort, suggestNear, distanceM, decodePolyline, formatDuration, distanceToPath, CITIES, cityOf } from './util.js'
import { routeMap } from './map.js'
import { state, page, toast, mascot, errorBox, dataReady, dist } from './main.js'
import { openLogin } from './auth.js'

export async function renderPlace(id) {
  const path = location.pathname
  let p = state.places.find(x => x.id === id)
  if (!p) {
    await dataReady()
    p = state.places.find(x => x.id === id)
  }
  if (location.pathname !== path) return
  if (!p) return page('Không thấy quán', errorBox('Không thấy quán này. Có thể quán đang chờ duyệt, đã bị ẩn, hoặc bạn đang mất mạng.'))

  const cat = CATEGORIES[p.category]
  const d = dist(p)
  const hours = hoursText(p.opening_hours)
  const closed = isOpenNow(p.opening_hours) === false
  const photosBox = h('div', { class: 'grid' })
  const reviewsBox = h('ul', { class: 'reviews' }, h('li', { class: 'muted' }, 'Đang tải đánh giá…'))
  // Bản đồ dùng Leaflet nên không lấy điểm Google; chỉ đưa link sang Google Maps (Google Maps URLs, miễn phí, không cần key)
  const gmaps = p.google_place_id
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${encodeURIComponent(p.google_place_id)}`
    : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`

  page(p.name, [
    p.cover_path
      ? h('figure', { class: 'cover' },
          h('img', { src: photoUrl(p.cover_path), width: 1280, height: 960, alt: `Ảnh thật tại ${p.name}`, fetchpriority: 'high' }),
          h('figcaption', { class: 'tag' }, `Ảnh thật · ${timeAgo(p.cover_at)}`))
      // Chưa có ảnh thật: dùng tranh vẽ theo loại món, ghi rõ là minh họa để không lẫn với "Ảnh thật"
      : h('figure', { class: 'cover illus' },
          h('img', { src: `covers/${p.category}.svg`, width: 640, height: 320, alt: `Hình minh họa quán ${cat.label.toLowerCase()}` }),
          h('figcaption', { class: 'tag' }, 'Hình minh họa · chưa có ảnh thật')),
    h('h1', { tabindex: -1 }, p.name),
    h('p', { class: 'muted' }, [cat.label, p.address].filter(Boolean).join(' · ')),
    h('p', { class: 'meta' },
      d != null && h('span', null, `Cách ${formatDistance(d)}${state.userPos ? '' : ' từ trung tâm thành phố'}`),
      hours && h('span', { class: closed ? 'muted' : 'open' }, closed && mascot('ngu', 24), hours)),
    p.suggested_by_name && h('p', { class: 'suggested' }, `Gợi ý bởi ${p.suggested_by_name}`),

    h('section', { class: 'card scores', 'aria-label': 'Điểm' },
      h('p', { class: 'score-main' },
        p.review_count >= 3 ? `Hometown ${formatStars(p.avg_stars)}★` : 'Hometown: Mới',
        h('small', null, ` (${p.review_count} đánh giá${DEMO ? ' mẫu' : ''})`)),
      // Quán minh họa trong bản demo không có thật: không dẫn sang Google Maps hay chỉ đường tới một tọa độ ngẫu nhiên
      !DEMO && h('p', { class: 'score-google muted' }, h('a', { href: gmaps, target: '_blank', rel: 'noopener' }, 'Xem đánh giá trên Google Maps'))),

    h('section', { class: 'card' },
      h('h2', null, DEMO ? 'Giá mẫu' : 'Giá thật'),
      h('p', { class: 'price-line' }, p.price_count >= 3
        ? [h('b', { class: 'price big' }, `Thường ${formatPrice(p.price_median)}`),
           ` · từ ${formatPrice(p.price_p25)} đến ${formatPrice(p.price_p75)} · theo ${p.price_count} ${DEMO ? 'đánh giá mẫu' : 'người đã ăn'}`]
        : p.price_min && p.price_max
          ? [h('b', null, `Khoảng ${formatPrice(p.price_min)}–${formatPrice(p.price_max)}`), ' · giá tham khảo lúc nhóm khảo sát']
          : 'Chưa có ai báo giá. Ăn xong báo giá giúp mọi người nhé!'),
      p.top_dishes.length > 0 && h('div', { class: 'chips' },
        h('span', { class: 'muted' }, 'Món được nhắc nhiều:'),
        p.top_dishes.map(x => h('span', { class: 'chip static' }, `${x.name} (${x.n})`)))),

    h('section', null, h('h2', null, 'Ảnh thật'), photosBox),
    h('section', null, h('h2', null, 'Đánh giá'), reviewsBox),

    h('nav', { class: 'actionbar', 'aria-label': 'Hành động' },
      h('a', { class: 'btn-ghost', href: `quan/${p.id}/chi-duong` }, 'Chỉ đường'),
      h('a', { class: 'btn', href: `quan/${p.id}/danh-gia` }, 'Viết đánh giá'),
      h('button', { type: 'button', class: 'btn-ghost icon-only', 'aria-label': 'Chia sẻ quán', onclick: () => share(p) }, '↗')),
  ])

  const load = () => Promise.all([fetchReviews(id), fetchPhotos(id)]).then(([reviews, photos]) => {
    if (location.pathname !== path) return
    renderPhotos(p, photos, reviews, photosBox)
    renderReviews(p, reviews, photos, reviewsBox)
  }, err => {
    console.error(err)
    photosBox.replaceChildren()
    reviewsBox.replaceChildren(h('li', null, errorBox('Chưa tải được đánh giá. Kiểm tra mạng rồi thử lại nhé.', load)))
  })
  load()
}

// ───────── Chỉ đường ngay trong app ─────────
// Valhalla trên máy chủ miễn phí của FOSSGIS: có chế độ xe máy, câu chỉ dẫn tiếng Việt, không cần key.
// Điều kiện dùng: ghi nguồn OSM kèm link sửa bản đồ, tối đa 1 yêu cầu/giây, không dùng nặng (routing.openstreetmap.de/about.html).
// ponytail: máy chủ demo, không cam kết chạy mãi; lỗi thì người dùng vẫn còn nút "Mở bằng Google Maps".
const ROUTER = 'https://valhalla1.openstreetmap.de/route'
const MODES = { motor_scooter: '🛵 Xe máy', pedestrian: '🚶 Đi bộ' }
const MAX_ROUTE_M = 30000 // xa hơn thì nhiều khả năng vị trí sai (máy tính đoán theo IP); không tốn máy chủ miễn phí

async function fetchRoute(from, to, costing) {
  const q = {
    locations: [{ lat: from.lat, lon: from.lng }, { lat: to.lat, lon: to.lng }],
    costing, directions_options: { language: 'vi-VN', units: 'kilometers' },
  }
  const r = await fetch(`${ROUTER}?json=${encodeURIComponent(JSON.stringify(q))}`)
  if (!r.ok) throw new Error(`route ${r.status}`)
  const { trip } = await r.json()
  return { ...trip.summary, steps: trip.legs[0].maneuvers, shape: decodePolyline(trip.legs[0].shape) }
}

const gmapsDir = p => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` +
  (p.google_place_id ? `&destination_place_id=${encodeURIComponent(p.google_place_id)}` : '')

export async function renderDirections(id) {
  const path = location.pathname
  let p = state.places.find(x => x.id === id)
  if (!p) {
    await dataReady()
    p = state.places.find(x => x.id === id)
  }
  if (location.pathname !== path) return
  if (!p) return page('Không thấy quán', errorBox('Không thấy quán này. Có thể quán đang chờ duyệt, đã bị ẩn, hoặc bạn đang mất mạng.'))

  const here = () => location.pathname === path
  // Mặc định xuất phát từ trường của thành phố (Hà Nội: KTQD, TP.HCM: UEH): không cần GPS, giám khảo mở trên laptop vẫn xem được.
  // Lấy theo thành phố của quán (trùng thành phố đang chọn, vì danh sách đã lọc theo thành phố) để mở thẳng link quán ở thành phố kia vẫn đúng.
  const start = (cityOf(p) ?? state.city ?? CITIES[0]).start
  const fromText = h('span', null, `Xuất phát: ${start.name}`)
  const gpsBtn = h('button', { type: 'button', class: 'link', disabled: true, onclick: useGps }, '📍 Đi từ chỗ tôi đang đứng')
  const mapEl = h('div', { class: 'route-map' })
  const sum = h('p', { class: 'route-sum', role: 'status' }, 'Bao đang tìm đường…')
  const steps = h('ol', { class: 'steps' })
  const arrived = h('div', { class: 'card ok-box', hidden: true }, mascot('vui', 48),
    h('div', { class: 'stack' }, h('strong', null, 'Tới nơi rồi! Chúc bạn ăn ngon'),
      h('a', { class: 'btn btn-sm', href: `quan/${p.id}/danh-gia` }, 'Ăn xong viết đánh giá')))
  const modes = h('div', { class: 'chips', role: 'group', 'aria-label': 'Đi bằng gì' },
    Object.entries(MODES).map(([key, label]) =>
      h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', 'data-mode': key, onclick: () => draw(key) }, label)))
  const routes = {} // theo chế độ đi, để đổi qua lại không phải hỏi lại máy chủ
  let from = start, gps = false, mode = null, ctl = null, reroutedAt = 0

  page(`Đường tới ${p.name}`, [
    h('h1', { tabindex: -1 }, `Đường tới ${p.name}`),
    // Bản demo là bài dự thi, chưa có người dùng thật: vẫn chỉ đường tới quán minh họa để xem thử, nhưng ghi rõ
    DEMO && h('p', { class: 'note' }, 'Quán minh họa, không có thật ở vị trí này: đường đi chỉ để xem thử tính năng.'),
    modes, h('p', { class: 'route-from' }, fromText, gpsBtn), sum, mapEl, arrived, steps,
    h('p', { class: 'small muted' },
      'Để vẽ đường, điểm xuất phát và vị trí quán được gửi tới máy chủ tìm đường miễn phí của FOSSGIS (Đức). Vị trí của bạn chỉ được gửi khi bạn bấm “Đi từ chỗ tôi đang đứng”, và app không lưu lại.'),
    h('p', { class: 'small muted' }, 'Đường đi: Valhalla, máy chủ FOSSGIS · Dữ liệu © ',
      h('a', { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener' }, 'OpenStreetMap'), ' · Thấy đường sai? ',
      h('a', { href: 'https://www.openstreetmap.org/fixthemap', target: '_blank', rel: 'noopener' }, 'Sửa bản đồ')),
    h('a', { class: 'btn-ghost', href: gmapsDir(p), target: '_blank', rel: 'noopener' }, 'Mở bằng Google Maps'),
  ], { href: `quan/${p.id}`, label: p.name })

  async function draw(key) {
    mode = key
    for (const b of modes.children) b.setAttribute('aria-pressed', String(b.dataset.mode === key))
    const far = distanceM(from, p)
    if (far > MAX_ROUTE_M) {
      sum.textContent = `Bạn đang cách quán ${formatDistance(far)}, xa quá nên Bao không vẽ đường. Nếu vị trí sai, bật GPS rồi tải lại trang, hoặc mở bằng Google Maps nhé.`
      return
    }
    sum.textContent = 'Bao đang tìm đường…'
    try {
      const r = routes[key] ??= await fetchRoute(from, p, key)
      if (!here() || mode !== key) return
      sum.textContent = `${formatDistance(r.length * 1000)} · khoảng ${formatDuration(r.time)} ${key === 'pedestrian' ? 'đi bộ' : 'đi xe máy'}`
      steps.replaceChildren(...r.steps.map(s => h('li', null, s.instruction,
        s.length >= 0.01 && h('span', { class: 'muted' }, ` · ${formatDistance(s.length * 1000)}`)))) // dưới 10 m thì làm tròn thành "0 m"
      ctl?.route(r.shape)
    } catch (err) {
      console.error(err)
      if (!here() || mode !== key) return
      sum.textContent = 'Chưa tìm được đường.'
      steps.replaceChildren(h('li', { class: 'empty' },
        errorBox('Máy chủ tìm đường chưa trả lời. Kiểm tra mạng rồi bấm thử lại, hoặc mở bằng Google Maps nhé.', () => draw(key))))
    }
  }

  // Sau khi bấm "Đi từ chỗ tôi": vị trí đầu tiên thay cho điểm xuất phát mặc định. Sau đó dời Bao theo bạn; đi lệch khỏi đường thì tìm lại.
  const onPos = (pos, acc = 0) => {
    state.userPos = pos
    ctl?.user(pos)
    const left = distanceM(pos, p)
    arrived.hidden = left > 50
    if (!gps) {
      gps = true
      from = pos
      for (const k in routes) delete routes[k]
      fromText.textContent = 'Xuất phát: chỗ bạn đang đứng, Bao đi theo bạn'
      gpsBtn.hidden = true
      return draw(mode)
    }
    // Lệch quá 40 m (hoặc quá sai số GPS lúc đó) thì tìm đường mới từ chỗ đang đứng.
    // Tối đa 30 giây một lần: máy chủ miễn phí chỉ cho 1 yêu cầu/giây, và GPS trong phố hay nhảy.
    const r = routes[mode]
    if (r && left > 50 && Date.now() - reroutedAt > 30000 && distanceToPath(pos, r.shape) > Math.max(40, acc)) {
      reroutedAt = Date.now()
      from = pos
      for (const k in routes) delete routes[k]
      toast('Bạn đi khác đường rồi, Bao tìm đường mới nhé')
      draw(mode)
    }
  }
  ctl = await routeMap(mapEl, p)
  if (!here()) return
  if (!ctl) mapEl.replaceChildren(h('p', { class: 'muted' }, 'Bản đồ đang nghỉ, bạn đi theo các bước bên dưới nhé.'))
  ctl?.user(start) // Bao đứng ở điểm xuất phát
  gpsBtn.disabled = false // bật sau khi có bản đồ, để vị trí đầu tiên không về trước khi bản đồ sẵn sàng
  draw(mode ?? (distanceM(start, p) <= 1500 ? 'pedestrian' : 'motor_scooter'))

  function useGps() {
    if (!navigator.geolocation) return toast(`Máy bạn không lấy được vị trí, Bao chỉ đường từ ${start.name} nhé`)
    gpsBtn.disabled = true
    toast('Bao đang tìm bạn…')
    const keepStart = msg => {
      navigator.geolocation.clearWatch(watch)
      gpsBtn.disabled = false
      toast(msg)
    }
    const watch = navigator.geolocation.watchPosition(g => {
      if (!here()) return navigator.geolocation.clearWatch(watch) // đã rời trang chỉ đường
      const pos = { lat: g.coords.latitude, lng: g.coords.longitude }
      const far = distanceM(pos, p)
      // Xa quá (thường là máy tính đoán vị trí theo IP): giữ điểm xuất phát mặc định, không làm nặng máy chủ miễn phí
      if (!gps && far > MAX_ROUTE_M) return keepStart(`Bạn đang cách quán ${formatDistance(far)}, xa quá nên Bao vẫn chỉ đường từ ${start.name} nhé`)
      onPos(pos, g.coords.accuracy)
    }, e => {
      if (gps || !here()) return
      keepStart(e.code === 1
        ? `Bạn chưa cho phép vị trí nên Bao vẫn chỉ đường từ ${start.name}. Muốn đi từ chỗ bạn thì cho phép vị trí cho trang này rồi bấm lại nhé`
        : `Chưa lấy được vị trí nên Bao vẫn chỉ đường từ ${start.name}. Ra chỗ thoáng rồi bấm lại nhé`)
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 })
  }
}

function photoAlt(p, photo, reviews) {
  const author = reviews.find(r => r.id === photo.review_id)?.display_name
  return `Ảnh món tại ${p.name}${author ? `, do ${author} chụp` : ''} ngày ${formatDate(photo.created_at)}`
}

function photoButton(p, photo, reviews) {
  return h('button', { type: 'button', class: 'photo', onclick: () => viewPhoto(p, photo, reviews) },
    h('img', { src: photoUrl(thumbPath(photo.storage_path)), width: 400, height: 300, loading: 'lazy', decoding: 'async', alt: photoAlt(p, photo, reviews) }),
    photo.status === 'pending' && h('span', { class: 'tag' }, 'Chờ duyệt'))
}

function renderPhotos(p, photos, reviews, box) {
  box.replaceChildren(...(photos.length
    ? photos.slice(0, 12).map(ph => photoButton(p, ph, reviews))
    : [h('p', { class: 'muted' }, 'Chưa có ảnh thật nào. Đến ăn rồi chụp tấm đầu tiên nhé!')]))
}

function renderReviews(p, reviews, photos, box) {
  if (!reviews.length) {
    box.replaceChildren(h('li', { class: 'empty' }, mascot('doi', 72),
      h('p', null, 'Chưa có đánh giá nào. Đến ăn rồi viết đánh giá đầu tiên nhé!')))
    return
  }
  box.replaceChildren(...reviews.map(r => h('li', { class: 'review card' },
    h('div', { class: 'review-head' },
      h('b', null, r.display_name),
      r.is_sample
        ? h('span', { class: 'badge sample' }, 'Mẫu')
        : [h('span', { class: 'badge' }, badgeFor(r.author_review_count)), h('span', { class: 'badge ok' }, '✓ Đã check-in')]),
    h('p', null,
      h('span', { class: 'stars', role: 'img', 'aria-label': `${r.stars} trên 5 sao` }, '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars)),
      r.price_paid != null && ` · Đã trả ${formatPrice(r.price_paid)}`),
    r.dishes.length > 0 && h('p', { class: 'muted' }, `Món: ${r.dishes.join(', ')}`),
    r.comment && h('p', { class: 'comment' }, r.comment),
    h('div', { class: 'grid small' }, photos.filter(ph => ph.review_id === r.id).map(ph => photoButton(p, ph, reviews))),
    h('div', { class: 'review-foot' },
      h('time', { datetime: r.review_date }, formatDate(r.review_date)),
      h('button', { type: 'button', class: 'link', onclick: () => reportFlow('review', r.id) }, 'Báo cáo')),
  )))
}

function viewPhoto(p, photo, reviews) {
  const dlg = h('dialog', { class: 'viewer', onclose: () => dlg.remove() },
    h('img', { src: photoUrl(photo.storage_path), width: photo.width ?? 1280, height: photo.height ?? 960, alt: photoAlt(p, photo, reviews) }),
    h('div', { class: 'viewer-bar' },
      h('span', null, photoAlt(p, photo, reviews)),
      h('button', { type: 'button', class: 'link', onclick: () => { dlg.close(); reportFlow('photo', photo.id) } }, 'Báo cáo ảnh'),
      h('button', { type: 'button', class: 'btn-ghost', onclick: () => dlg.close() }, 'Đóng')))
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close() })
  document.body.append(dlg)
  dlg.showModal()
}

const REASONS = ['Sai sự thật', 'Quảng cáo hoặc spam', 'Lời lẽ xấu', 'Ảnh không chụp ở quán', 'Lý do khác']

function reportFlow(type, targetId) {
  if (!state.user) return openLogin()
  const form = h('form', { method: 'dialog' },
    h('h2', null, type === 'review' ? 'Báo cáo đánh giá' : 'Báo cáo ảnh'),
    h('p', { class: 'muted' }, 'Đủ 3 người báo cáo thì nội dung tự ẩn. Nhóm xem lại trong ngày.'),
    h('fieldset', { class: 'radios' }, h('legend', null, 'Lý do'),
      REASONS.map((r, i) => h('label', null, h('input', { type: 'radio', name: 'reason', value: r, required: true, checked: i === 0 }), r))),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn-ghost', onclick: () => dlg.close() }, 'Thôi'),
      h('button', { class: 'btn' }, 'Gửi báo cáo')))
  const dlg = h('dialog', { class: 'sheet-dialog', onclose: () => dlg.remove() }, form)
  form.addEventListener('submit', async e => {
    e.preventDefault()
    try {
      await report(type, targetId, form.elements.reason.value)
      toast('Cảm ơn bạn! Nhóm sẽ xem lại trong ngày')
    } catch (err) {
      toast(err.code === '23505' ? 'Bạn đã báo cáo mục này rồi' : 'Chưa gửi được báo cáo. Kiểm tra mạng rồi thử lại nhé')
    }
    dlg.close()
  })
  document.body.append(dlg)
  dlg.showModal()
}

async function share(p) {
  const url = new URL(`quan/${p.id}`, document.baseURI).href
  if (navigator.share) {
    try { await navigator.share({ title: p.name, text: `${p.name} trên Hometown`, url }) } catch {}
    return
  }
  try {
    await navigator.clipboard.writeText(url)
    toast('Đã chép link quán')
  } catch {
    prompt('Chép link này để gửi bạn nhé', url)
  }
}

// Địa danh nổi tiếng: ảnh thật từ Wikimedia Commons (ghi tác giả và giấy phép theo yêu cầu của giấy phép),
// mô tả từ Wikipedia tiếng Việt (CC BY-SA 4.0), kèm quán ngon gần đó. Dữ liệu tạo bằng scripts/landmarks.mjs.
const LM_TYPES = {
  temple: 'Chùa, đền', church: 'Nhà thờ', museum: 'Bảo tàng, công trình', lake: 'Hồ, sông', park: 'Công viên',
  zoo: 'Sở thú', bridge: 'Cầu, hầm', tower: 'Tòa nhà cao tầng', theatre: 'Nhà hát', stadium: 'Sân vận động',
  market: 'Chợ, mua sắm', palace: 'Dinh thự, thành cổ', post: 'Bưu điện', hotel: 'Khách sạn', street: 'Phố nổi tiếng',
  school: 'Trường học', monument: 'Tượng đài, quảng trường',
}

export function openLandmark(l) {
  const ph = l.photo
  const near = suggestNear(state.places, l)
  const desc = l.desc && l.desc[0].toUpperCase() + l.desc.slice(1)
  // Bản demo: vài câu cảm nhận mẫu (có nhãn "Mẫu") lấy từ demo.json
  const notes = h('section', { class: 'lm-notes', hidden: true })
  if (DEMO) demoData().then(d => {
    const list = d.landmarkNotes?.[l.id] ?? []
    if (!list.length) return
    notes.replaceChildren(h('h3', null, 'Cảm nhận'), h('ul', { class: 'reviews' }, list.map(n => h('li', { class: 'review card' },
      h('div', { class: 'review-head' }, h('b', null, n.by), h('span', { class: 'badge sample' }, 'Mẫu')),
      h('p', null, h('span', { class: 'stars', role: 'img', 'aria-label': `${n.stars} trên 5 sao` }, '★'.repeat(n.stars) + '☆'.repeat(5 - n.stars))),
      h('p', { class: 'comment' }, n.text)))))
    notes.hidden = false
  }, () => {})
  const d = dist(l)
  const dlg = h('dialog', { class: 'sheet-dialog landmark', 'aria-labelledby': 'lm-title', onclose: () => dlg.remove() },
    h('figure', { class: 'lm-photo' },
      h('img', { src: ph.src, width: ph.w, height: ph.h, alt: `Ảnh chụp ${l.name}, tác giả ${ph.author}`, decoding: 'async' }),
      h('figcaption', { class: 'tag' }, 'Ảnh thật')),
    h('p', { class: 'chip static lm-type' }, h('img', { src: `icons/lm-${l.type}.svg`, width: 22, height: 22, alt: '' }), LM_TYPES[l.type] ?? 'Địa danh'),
    h('h2', { id: 'lm-title' }, l.name),
    h('p', { class: 'muted' }, [desc, l.city, d != null && `cách ${formatDistance(d)}`].filter(Boolean).join(' · ')),
    l.extract && h('p', null, l.extract),
    notes,
    near.length > 0 && h('section', null,
      h('h3', null, 'Ăn gì gần đây?'),
      h('ul', { class: 'near' }, near.map(({ p, d }) => h('li', null,
        h('a', { href: `quan/${p.id}`, onclick: () => dlg.close() }, h('b', null, p.name)),
        ` · ${priceShort(p, DEMO)} · ${formatDistance(d)}`)))),
    h('p', { class: 'small muted credit' },
      'Ảnh: ', h('a', { href: ph.page, target: '_blank', rel: 'noopener' }, ph.author), ' · ',
      ph.licenseUrl ? h('a', { href: ph.licenseUrl, target: '_blank', rel: 'noopener' }, ph.license) : ph.license,
      ' · Wikimedia Commons. Nội dung: ', h('a', { href: l.wiki, target: '_blank', rel: 'noopener' }, 'Wikipedia'), ' (CC BY-SA 4.0).'),
    h('div', { class: 'row' },
      h('a', { class: 'btn', href: `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`, target: '_blank', rel: 'noopener' }, 'Chỉ đường'),
      h('button', { type: 'button', class: 'btn-ghost', onclick: () => dlg.close() }, 'Đóng')),
  )
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close() })
  document.body.append(dlg)
  dlg.showModal()
}
