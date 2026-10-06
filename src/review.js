// Viết đánh giá (check-in, nén ảnh, gửi) và đề xuất quán mới.
// Màn "Bạn đang ở quán" chỉ là gợi ý trên máy; kiểm tra thật nằm trong hàm submit_review của database.
import { submitReview, uploadPhoto, suggestPlace } from './supabase.js'
import { pickLocation } from './map.js'
import { CATEGORIES, h, distanceM, formatDistance } from './util.js'
import { state, page, toast, mascot, errorBox, dataReady, loadData, origin } from './main.js'

const ERR = {
  not_authenticated: 'Phiên đăng nhập đã hết. Đăng nhập lại rồi gửi nhé',
  place_not_found: 'Quán này không còn trên bản đồ',
  gps_inaccurate: 'Vị trí chưa đủ chính xác. Ra chỗ thoáng hơn rồi check-in lại nhé',
  too_far: 'Bạn đang ở xa quán quá. Đến quán rồi check-in lại nhé',
  already_reviewed_today: 'Hôm nay bạn đã đánh giá quán này rồi. Mai quay lại nhé',
  daily_limit: 'Hôm nay bạn đã viết 10 đánh giá rồi, mai viết tiếp nhé',
  comment_has_contact: 'Nhận xét không được có link hay số điện thoại. Bỏ phần đó đi rồi gửi lại nhé',
  comment_banned_word: 'Nhận xét có từ chưa đẹp. Sửa lại một chút rồi gửi nhé',
}

// Nén trên máy bằng canvas. Vẽ lại qua canvas nên EXIF (có GPS) mất.
export async function compress(file, maxEdge) {
  if (!file.type.startsWith('image/') || file.size > 10e6) throw new Error('bad_image')
  const bmp = await createImageBitmap(file) // trình duyệt hiện đại tự xoay theo EXIF
  const k = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  const toBlob = type => new Promise(r => c.toBlob(r, type, 0.8))
  let blob = await toBlob('image/webp')
  // Safari và mọi trình duyệt trên iOS không xuất được WebP: toBlob không báo lỗi mà trả PNG nặng gấp ~10 lần
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg')
  return { blob, width: c.width, height: c.height }
}

async function findPlace(id) {
  let p = state.places.find(x => x.id === id)
  if (!p) {
    await dataReady()
    p = state.places.find(x => x.id === id)
  }
  return p
}

const getPosition = () => new Promise((ok, fail) =>
  navigator.geolocation
    ? navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
    : fail({ code: 2 }))

const geoError = e => (e.code === 1
  ? 'Bạn cần cho phép vị trí. Mở cài đặt trang web trong trình duyệt, bật quyền Vị trí cho trang này rồi thử lại nhé'
  : 'Chưa lấy được vị trí. Ra chỗ thoáng hơn rồi thử lại nhé')

export async function renderReview(id) {
  const path = location.pathname
  const p = await findPlace(id)
  if (location.pathname !== path) return
  if (!p) return page('Không thấy quán', errorBox('Không thấy quán này. Có thể quán đã bị ẩn hoặc bạn đang mất mạng.'))

  let pos = null // chỉ giữ trong bộ nhớ tới lúc gửi xong
  const back = { href: `quan/${p.id}`, label: p.name }
  const status = h('div', { class: 'card checkin', 'aria-live': 'polite' })
  const btn = h('button', { type: 'button', class: 'btn', onclick: checkin }, 'Check-in tại quán')
  const form = reviewForm(p)
  form.hidden = true
  status.append(h('p', null, 'Để điểm của app đáng tin, bạn cần đang ở quán (trong vòng 150 m). App chỉ dùng vị trí để tính khoảng cách, không lưu lại.'), btn)
  page(`Đánh giá ${p.name}`, [h('h1', { tabindex: -1 }, `Đánh giá ${p.name}`), status, form], back)

  async function checkin() {
    btn.disabled = true
    btn.textContent = 'Đang lấy vị trí…'
    try {
      const { latitude: lat, longitude: lng, accuracy } = (await getPosition()).coords
      const d = distanceM({ lat, lng }, p)
      if (accuracy > 100) return retry(`Vị trí chưa đủ chính xác (sai số khoảng ${Math.round(accuracy)} m). Ra chỗ thoáng hơn rồi thử lại nhé`)
      if (d - accuracy > 150) return retry(`Bạn đang cách quán khoảng ${formatDistance(d)}. Chỉ đánh giá được khi đang ở quán (trong 150 m), để ai cũng tin được điểm của app. Đến quán rồi check-in lại nhé`)
      pos = { lat, lng, accuracy }
      status.replaceChildren(h('p', { class: 'ok-box' }, mascot('vui', 48), h('span', null, h('b', null, 'Bạn đang ở quán'), ` · cách khoảng ${formatDistance(d)}`)))
      form.hidden = false
      form.querySelector('input')?.focus()
    } catch (e) {
      retry(geoError(e))
    }
  }
  function retry(msg) {
    pos = null
    form.hidden = true
    btn.disabled = false
    btn.textContent = 'Check-in lại'
    status.replaceChildren(h('p', { class: 'warn' }, mascot('buon', 48), h('span', null, msg)), btn)
  }

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const v = form.values()
    if (!v.stars) return toast('Chọn số sao trước nhé')
    if (v.price != null && !(v.price >= 1000 && v.price <= 500000)) return toast('Giá phải từ 1k đến 500k nhé')
    const submit = form.querySelector('[type=submit]')
    submit.disabled = true
    submit.textContent = 'Đang gửi…'
    let reviewId
    try {
      reviewId = await submitReview({
        p_place_id: p.id, p_lat: pos.lat, p_lng: pos.lng, p_accuracy_m: pos.accuracy,
        p_stars: v.stars, p_price_paid: v.price, p_dishes: v.dishes, p_comment: v.comment,
      })
    } catch (err) {
      const msg = ERR[err.message] ?? 'Chưa gửi được. Kiểm tra mạng rồi bấm gửi lại nhé'
      submit.disabled = false
      submit.textContent = 'Gửi đánh giá'
      if (err.message === 'too_far' || err.message === 'gps_inaccurate') retry(msg)
      else toast(msg)
      return
    }
    pos = null
    submit.textContent = 'Đang tải ảnh…'
    const failed = await uploadAll(p, reviewId, v.files.map((f, i) => ({ file: f, n: i + 1 })), submit)
    loadData() // cập nhật điểm và giá thật trên bản đồ
    done(p, reviewId, v.files.length, failed)
  })
}

async function uploadAll(p, reviewId, items, label) {
  const failed = []
  for (const [i, it] of items.entries()) {
    if (label) label.textContent = `Đang tải ảnh ${i + 1}/${items.length}…`
    try {
      const big = await compress(it.file, 1280)
      const thumb = await compress(it.file, 400)
      await uploadPhoto(state.user.id, reviewId, p.id, it.n, big, thumb)
    } catch (err) {
      console.error(err)
      failed.push(it)
    }
  }
  return failed
}

function done(p, reviewId, photoCount, failed) {
  const retryBox = h('div')
  const showFailed = list => {
    if (!list.length) return retryBox.replaceChildren(h('p', null, 'Ảnh đã lên đủ rồi.'))
    const b = h('button', { type: 'button', class: 'btn-ghost', onclick: async () => {
      b.disabled = true
      showFailed(await uploadAll(p, reviewId, list, b))
    } }, 'Thử lại')
    retryBox.replaceChildren(h('p', { class: 'warn' }, `${list.length} ảnh chưa lên được. Kiểm tra mạng rồi bấm thử lại nhé.`), b)
  }
  if (failed.length) showFailed(failed)
  page('Cảm ơn!', h('div', { class: 'empty' },
    mascot('vui', 120),
    h('h1', { tabindex: -1 }, 'Cảm ơn thổ địa!'),
    h('p', null, 'Đánh giá của bạn đã lên bản đồ.'),
    photoCount > 0 && h('p', { class: 'muted' }, 'Ảnh của tài khoản mới hiện sau khi nhóm duyệt (thường trong ngày). Từ đánh giá thứ 3, ảnh lên ngay.'),
    retryBox,
    h('a', { href: `quan/${p.id}`, class: 'btn' }, 'Xem quán')), { href: `quan/${p.id}`, label: p.name })
}

const FACES = [['😖', 'Tệ'], ['😕', 'Tạm'], ['😐', 'Được'], ['😋', 'Ngon'], ['🤩', 'Tuyệt']]

function reviewForm(p) {
  const dishes = new Set()
  let files = []

  const price = h('input', { id: 'price', type: 'number', inputmode: 'decimal', min: '1', max: '500', step: '0.5', placeholder: '35' })
  const dishInput = h('input', { id: 'dish', type: 'text', maxlength: '40', placeholder: 'Thêm món khác', enterkeyhint: 'done' })
  const dishChips = h('div', { class: 'chips' })
  const comment = h('textarea', { id: 'comment', maxlength: '200', rows: '3', placeholder: 'Một câu thôi: ngon chỗ nào, có gì cần lưu ý?' })
  const counter = h('span', { class: 'muted counter' }, '0/200')
  const fileInput = h('input', { id: 'photos', type: 'file', accept: 'image/*', multiple: true, class: 'visually-hidden' })
  const previews = h('div', { class: 'grid small' })

  const toggleDish = name => {
    if (dishes.has(name)) dishes.delete(name)
    else if (dishes.size >= 5) return toast('Tối đa 5 món thôi nhé')
    else dishes.add(name)
    drawDishes()
  }
  const drawDishes = () => {
    const names = [...new Set([...p.top_dishes.map(x => x.name), ...dishes])]
    dishChips.replaceChildren(...names.map(n =>
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(dishes.has(n)), onclick: () => toggleDish(n) }, n)))
  }
  const addDish = () => {
    const n = dishInput.value.trim()
    if (n && !dishes.has(n)) toggleDish(n)
    dishInput.value = ''
  }
  dishInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addDish() } })
  comment.addEventListener('input', () => { counter.textContent = `${comment.value.length}/200` })

  const drawFiles = () => {
    previews.replaceChildren(...files.map((f, i) => {
      const url = URL.createObjectURL(f)
      return h('div', { class: 'photo' },
        h('img', { src: url, width: 120, height: 120, alt: `Ảnh ${i + 1} bạn chọn`, onload: () => URL.revokeObjectURL(url) }),
        h('button', { type: 'button', class: 'remove', 'aria-label': `Bỏ ảnh ${i + 1}`, onclick: () => { files.splice(i, 1); drawFiles() } }, '×'))
    }))
  }
  fileInput.addEventListener('change', () => {
    for (const f of fileInput.files) {
      if (!f.type.startsWith('image/')) toast('Chỉ nhận file ảnh nhé')
      else if (f.size > 10e6) toast('Ảnh lớn hơn 10 MB, chọn ảnh khác nhé')
      else if (files.length >= 3) { toast('Tối đa 3 ảnh thôi nhé'); break }
      else files.push(f)
    }
    fileInput.value = ''
    drawFiles()
  })
  drawDishes()

  const form = h('form', { class: 'review-form', novalidate: true },
    h('fieldset', { class: 'faces' },
      h('legend', null, 'Bạn chấm mấy sao?'),
      FACES.map(([face, label], i) => h('label', null,
        h('input', { type: 'radio', name: 'stars', value: String(i + 1), class: 'visually-hidden' }),
        h('span', { class: 'face', 'aria-hidden': 'true' }, face),
        h('span', null, `${i + 1} sao · ${label}`)))),
    h('div', { class: 'field' },
      h('label', { for: 'price' }, 'Bạn đã trả bao nhiêu (một người)?'),
      h('div', { class: 'price-input' }, price, h('span', null, 'nghìn đồng')),
      h('div', { class: 'chips' }, [25, 30, 35, 40].map(k =>
        h('button', { type: 'button', class: 'chip', onclick: () => { price.value = k } }, `${k}k`)))),
    h('div', { class: 'field' },
      h('label', { for: 'dish' }, 'Món đã ăn'),
      dishChips,
      h('div', { class: 'row' }, dishInput, h('button', { type: 'button', class: 'btn-ghost', onclick: addDish }, 'Thêm'))),
    h('div', { class: 'field' },
      h('label', { for: 'comment' }, 'Nhận xét'),
      comment, counter),
    h('div', { class: 'field' },
      h('span', { class: 'label' }, 'Ảnh chụp tại quán (tối đa 3)'),
      previews,
      fileInput, h('label', { for: 'photos', class: 'btn-ghost file-btn' }, '📷 Chụp hoặc chọn ảnh')),
    h('button', { type: 'submit', class: 'btn btn-block' }, 'Gửi đánh giá'),
  )
  form.values = () => ({
    stars: +(form.elements.stars.value || 0),
    price: price.value ? Math.round(+price.value * 1000) : null,
    dishes: [...dishes],
    comment: comment.value.trim(),
    files,
  })
  return form
}

// ───────── Đề xuất quán mới ─────────

export async function renderSuggest() {
  await dataReady()
  const o = origin() ?? { lat: 21.0285, lng: 105.8542 }
  const mapBox = h('div', { class: 'pick-map' }, h('p', { class: 'muted' }, 'Đang tải bản đồ…'))
  const where = h('p', { class: 'muted', 'aria-live': 'polite' }, 'Kéo ghim tới đúng vị trí quán, hoặc bấm “Dùng vị trí hiện tại” khi đang đứng ở quán.')
  let picker = null
  let here = null

  const useHere = async () => {
    try {
      const { latitude: lat, longitude: lng } = (await getPosition()).coords
      here = { lat, lng }
      picker?.set(here)
      where.textContent = 'Đã lấy vị trí hiện tại của bạn làm vị trí quán.'
    } catch (e) {
      toast(geoError(e))
    }
  }

  const num = (id, ph) => h('input', { id, type: 'number', inputmode: 'decimal', min: '1', max: '500', step: '0.5', placeholder: ph })
  const pmin = num('pmin', '25')
  const pmax = num('pmax', '45')
  const form = h('form', { class: 'review-form' },
    h('div', { class: 'field' }, h('label', { for: 'name' }, 'Tên quán'),
      h('input', { id: 'name', required: true, minlength: '2', maxlength: '80', autocomplete: 'off', placeholder: 'Vd: Bún chả cô Hương' })),
    h('div', { class: 'field' }, h('label', { for: 'cat' }, 'Loại món'),
      h('select', { id: 'cat', required: true }, Object.entries(CATEGORIES).map(([k, c]) => h('option', { value: k }, c.label)))),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Khoảng giá (nghìn đồng)'),
      h('div', { class: 'row' }, h('label', { for: 'pmin' }, 'từ'), pmin, h('label', { for: 'pmax' }, 'đến'), pmax)),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Vị trí quán'), mapBox, where,
      h('button', { type: 'button', class: 'btn-ghost', onclick: useHere }, '◎ Dùng vị trí hiện tại')),
    h('div', { class: 'field' }, h('label', { for: 'addr' }, 'Địa chỉ (không bắt buộc)'),
      h('input', { id: 'addr', maxlength: '200', placeholder: 'Số nhà, tên đường' })),
    state.areas.length > 0 && h('div', { class: 'field' }, h('label', { for: 'parea' }, 'Gần cụm trường nào?'),
      h('select', { id: 'parea' }, h('option', { value: '' }, 'Không rõ'),
        state.areas.map(a => h('option', { value: String(a.id) }, a.name)))),
    h('button', { type: 'submit', class: 'btn btn-block' }, 'Gửi đề xuất'),
  )

  page('Đề xuất quán', [
    h('h1', { tabindex: -1 }, 'Đề xuất quán mới'),
    h('p', { class: 'muted' }, 'Quán ngon dưới 50k mà chưa có trên bản đồ? Gửi cho nhóm nhé. Nhóm duyệt trong vòng 24 giờ.'),
    form,
  ])

  pickLocation(mapBox, here ?? o).then(pk => {
    picker = pk
    if (pk) return
    mapBox.replaceChildren(h('p', { class: 'muted' }, 'Bản đồ đang nghỉ. Ra đứng ở quán rồi bấm “Dùng vị trí hiện tại” nhé.'))
    if (!here) where.textContent = ''
  })

  form.addEventListener('submit', async e => {
    e.preventDefault()
    if (!form.reportValidity()) return
    const loc = picker ? picker.get() : here
    if (!loc) return toast('Chọn vị trí quán: kéo ghim trên bản đồ hoặc bấm “Dùng vị trí hiện tại” nhé')
    const k = el => (el.value ? Math.round(+el.value * 1000) : null)
    const row = {
      name: form.elements.name.value.trim(),
      category: form.elements.cat.value,
      lat: loc.lat, lng: loc.lng,
      address: form.elements.addr.value.trim() || null,
      area_id: form.elements.parea?.value ? +form.elements.parea.value : null,
      price_min: k(pmin), price_max: k(pmax),
    }
    if (row.price_min && row.price_max && row.price_max < row.price_min) return toast('Giá “đến” phải lớn hơn giá “từ” nhé')
    const submit = form.querySelector('[type=submit]')
    submit.disabled = true
    try {
      await suggestPlace(row)
    } catch (err) {
      submit.disabled = false
      return toast(err.code === '42501'
        ? 'Hôm nay bạn đã đề xuất 5 quán rồi, mai gửi tiếp nhé'
        : 'Chưa gửi được. Kiểm tra lại thông tin và mạng rồi thử lại nhé')
    }
    page('Đã gửi đề xuất', h('div', { class: 'empty' },
      mascot('vui', 120),
      h('h1', { tabindex: -1 }, 'Đã gửi, cảm ơn bạn!'),
      h('p', null, `“${row.name}” đang chờ duyệt. Nhóm sẽ đến ăn thử và duyệt trong vòng 24 giờ.`),
      h('p', { class: 'muted' }, 'Bạn xem trạng thái trong mục Của tôi.'),
      h('a', { href: 'cua-toi', class: 'btn' }, 'Xem Của tôi')))
  })
}
