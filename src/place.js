// Trang chi tiết quán: ảnh, giá thật, điểm của app, link sang Google Maps, đánh giá, báo cáo.
import { DEMO, demoData, fetchReviews, fetchPhotos, photoUrl, thumbPath, report } from './supabase.js'
import { CATEGORIES, h, hoursText, isOpenNow, formatPrice, formatStars, formatDistance, badgeFor, timeAgo, formatDate, distanceM, priceShort } from './util.js'
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
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` +
    (p.google_place_id ? `&destination_place_id=${encodeURIComponent(p.google_place_id)}` : '')
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
      d != null && h('span', null, `Cách ${formatDistance(d)}${state.userPos ? '' : ' từ tâm cụm trường'}`),
      hours && h('span', { class: closed ? 'muted' : 'open' }, closed && mascot('ngu', 24), hours)),
    p.suggested_by_name && h('p', { class: 'suggested' }, `Gợi ý bởi ${p.suggested_by_name}`),

    h('section', { class: 'card scores', 'aria-label': 'Điểm' },
      h('p', { class: 'score-main' },
        p.review_count >= 3 ? `Quán Quen ${formatStars(p.avg_stars)}★` : 'Quán Quen: Mới',
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
      !DEMO && h('a', { class: 'btn-ghost', href: dir, target: '_blank', rel: 'noopener' }, 'Chỉ đường'),
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
    try { await navigator.share({ title: p.name, text: `${p.name} trên Quán Quen`, url }) } catch {}
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
  const near = state.places
    .map(p => ({ p, d: distanceM(l, p) }))
    .filter(x => x.d <= 2000)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
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
