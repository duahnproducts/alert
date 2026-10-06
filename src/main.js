// Router, trạng thái chung, bộ lọc, ngăn kéo danh sách, thẻ xem nhanh, trang Về dự án.
import './style.css'
import { DEMO, readCache, fetchPlaces, photoUrl, thumbPath } from './supabase.js'
import { initMap, showPlaces, select as selectPin, moveTo, showUser, showLandmarks, toggleLandmarks } from './map.js'
import {
  CATEGORIES, CITIES, cityOf, h, normalizeVi, distanceM, isOpenNow, filterPrice, priceShort, scoreShort, formatDistance, placeLabel, suggestNear,
} from './util.js'
import { renderPlace, renderDirections, openLandmark } from './place.js'
import { renderReview, renderSuggest } from './review.js'
import { initAuth, requireLogin, renderMine } from './auth.js'

// Thành phố người dùng chọn, lưu trên máy để lần sau không hỏi lại
const CITY_KEY = 'qq-city'
const savedCity = () => {
  try { return CITIES.find(c => c.name === localStorage.getItem(CITY_KEY)) } catch { return undefined }
}

export const state = {
  city: savedCity(),
  places: [], areas: [], savedAt: null,
  q: '', price: null, open: false, cats: new Set(), sort: 'dist',
  userPos: null, // chỉ giữ trong bộ nhớ, không lưu
  inBounds: null, listMode: false, mapFailed: false, user: null, loading: false,
  landmarks: true, // hiện địa danh nổi tiếng trên bản đồ
}

const $ = id => document.getElementById(id)
const TITLE = document.title

// ───────── Tiện ích giao diện dùng chung ─────────

export const mascot = (mood, size = 96) =>
  h('img', { src: `icons/bebao-${mood}.svg`, width: size, height: size, alt: '', class: 'mascot' })

let toastTimer
export function toast(msg) {
  const t = $('toast')
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000)
}

const placeIcon = (p, size = 40) =>
  h('span', { class: 'thumb icon', style: `--c:${CATEGORIES[p.category].color}` },
    h('img', { src: `icons/${p.category}.svg`, width: size, height: size, alt: '' }))

// Hiện một trang con (mọi màn trừ bản đồ). Bản đồ vẫn giữ nguyên phía sau để quay lại không phải vẽ lại.
export function page(title, nodes, back = { href: './', label: 'Bản đồ' }) {
  document.title = `${title} · Hometown`
  $('home').hidden = true
  const main = $('page')
  main.hidden = false
  main.replaceChildren(h('a', { href: back.href, class: 'back' }, `‹ ${back.label}`),
    DEMO && h('p', { class: 'demo-banner' }, '🧪 Bản demo: quán và đánh giá là minh họa, không phải quán thật'), h('div', null, nodes))
  scrollTo(0, 0)
  main.querySelector('h1')?.focus({ preventScroll: true })
}

export const errorBox = (msg, retry) =>
  h('div', { class: 'empty' }, mascot('buon', 72), h('p', null, msg),
    retry && h('button', { type: 'button', class: 'btn-ghost', onclick: retry }, 'Thử lại'))

// ───────── Dữ liệu ─────────

let ready = Promise.resolve()
export const dataReady = () => ready

function setData(d) {
  for (const p of d.places) {
    p._search = normalizeVi([p.name, CATEGORIES[p.category]?.label, ...(p.top_dishes ?? []).map(x => x.name)].join(' '))
  }
  state.places = d.places.filter(p => CATEGORIES[p.category])
  state.areas = d.areas
  state.savedAt = d.savedAt
}

export function loadData() {
  state.loading = true
  renderList()
  ready = fetchPlaces().then(d => {
    setData(d)
    $('saved-at').hidden = true
  }, err => {
    console.error(err)
    if (state.savedAt) {
      const t = new Date(state.savedAt)
      const two = n => String(n).padStart(2, '0')
      $('saved-at').textContent = `Mất kết nối · dữ liệu lưu lúc ${two(t.getHours())}:${two(t.getMinutes())} ngày ${two(t.getDate())}/${two(t.getMonth() + 1)}`
      $('saved-at').hidden = false
    }
  }).then(() => {
    state.loading = false
    renderHome()
    startMap()
  })
  return ready
}

// Vị trí mặc định khi chưa chia sẻ hoặc chặn vị trí: trường của thành phố đang chọn (Hà Nội: KTQD, TP.HCM: UEH)
export const defaultSpot = () => (state.city ?? CITIES[0]).start

// Khoảng cách tính từ vị trí của bạn, chưa có thì từ vị trí mặc định
export function origin() {
  return state.userPos ?? (state.city ? defaultSpot() : null)
}

export function dist(p) {
  const o = origin()
  return o ? distanceM(o, p) : null
}

function filtered() {
  const q = normalizeVi(state.q.trim())
  return state.places.filter(p => {
    if (state.city && cityOf(p) !== state.city) return false
    if (state.cats.size && !state.cats.has(p.category)) return false
    const price = filterPrice(p)
    if (state.price === 'u30' && !(price < 30000)) return false
    if (state.price === '30_50' && !(price >= 30000 && price <= 50000)) return false
    if (state.open && isOpenNow(p.opening_hours) === false) return false // không rõ giờ thì không lọc
    if (q && !p._search.includes(q)) return false
    return true
  })
}

function sorted(list) {
  const score = p => (p.review_count >= 3 ? p.avg_stars : 0)
  const by = {
    dist: (a, b) => (dist(a) ?? 0) - (dist(b) ?? 0),
    score: (a, b) => score(b) - score(a) || b.review_count - a.review_count,
    price: (a, b) => (filterPrice(a) ?? 1e9) - (filterPrice(b) ?? 1e9),
  }
  return [...list].sort(by[state.sort])
}

// ───────── Màn bản đồ ─────────

function renderHome() {
  const list = filtered()
  showPlaces(list, p => placeLabel(p, dist(p)))
  renderList(list)
  renderNear(list)
}

// ───────── Gợi ý quanh bạn ─────────
// Thẻ mời chia sẻ vị trí, có vị trí thì gợi ý quán đang mở gần bạn. Vị trí chỉ nằm trong bộ nhớ của tab, tính ngay trên máy.

let near = 'off' // 'off' | 'ask' | 'wait' | 'show' (quanh vị trí của bạn) | 'default' (quanh vị trí mặc định)

function renderNear(list = filtered()) {
  const box = $('near')
  box.hidden = near === 'off'
  if (box.hidden) return
  // "Để sau" ở thẻ mời nghĩa là không chia sẻ: chuyển sang gợi ý quanh vị trí mặc định. Đóng thẻ gợi ý thì ẩn hẳn.
  const close = h('button', {
    type: 'button', class: 'close', 'aria-label': near === 'ask' ? 'Để sau' : 'Đóng gợi ý',
    onclick: () => { near = near === 'ask' ? 'default' : 'off'; renderNear() },
  }, '×')
  if (near === 'ask' || near === 'wait') {
    box.replaceChildren(close,
      h('div', { class: 'row' }, mascot('doi', 56), h('div', null,
        h('strong', null, 'Đói chưa? Cho Bao biết bạn đang ở đâu nhé'),
        h('p', { class: 'muted' }, 'Bao gợi ý quán ngon đang mở gần bạn. Vị trí chỉ dùng ngay trên máy, không lưu, không gửi đi đâu.'))),
      h('button', { type: 'button', class: 'btn btn-sm', onclick: locate, disabled: near === 'wait' },
        near === 'wait' ? 'Bao đang tìm bạn…' : '📍 Chia sẻ vị trí'))
    return
  }
  const mine = near === 'show'
  const spot = mine ? null : defaultSpot()
  // Vị trí mặc định chỉ là ước lượng (và quán demo ở TP.HCM cách UEH khoảng 4 km) nên tìm rộng hơn
  const radius = mine ? 2000 : 5000
  const picks = suggestNear(list, mine ? state.userPos : spot, { radius })
  box.replaceChildren(close,
    h('div', { class: 'near-head' }, h('strong', null, mine ? 'Gợi ý quanh bạn' : `Gợi ý quanh ${spot.name}`),
      h('button', { type: 'button', class: 'link', onclick: locate }, mine ? 'Cập nhật vị trí' : '📍 Dùng vị trí của tôi')),
    !mine && h('p', { class: 'muted' }, 'Bạn chưa chia sẻ vị trí nên Bao tạm tính khoảng cách từ đây.'),
    picks.length
      ? h('ul', null, picks.map(({ p, d }) => h('li', null, h('a', { href: `quan/${p.id}` },
        placeIcon(p, 28),
        h('span', { class: 'info' }, h('b', null, p.name),
          h('span', { class: 'muted' },
            [formatDistance(d), priceShort(p, DEMO), scoreShort(p), isOpenNow(p.opening_hours) && 'Đang mở'].filter(Boolean).join(' · ')))))))
      : h('p', { class: 'muted' }, `Trong ${radius / 1000} km quanh ${mine ? 'bạn' : spot.name} chưa có quán đang mở nào khớp. Thử bỏ bớt bộ lọc hoặc kéo bản đồ xem quán xa hơn nhé.`))
}

function locate() {
  if (!navigator.geolocation) {
    near = 'default'
    renderNear()
    return toast(`Máy bạn không lấy được vị trí. Bao tính khoảng cách từ ${defaultSpot().name} nhé`)
  }
  if (state.userPos) toast('Đang lấy vị trí…')
  else { near = 'wait'; renderNear() }
  navigator.geolocation.getCurrentPosition(g => {
    state.userPos = { lat: g.coords.latitude, lng: g.coords.longitude }
    const c = cityOf(state.userPos)
    if (c && c !== state.city) setCity(c) // đang đứng ở thành phố kia thì đổi sang luôn
    state.sort = 'dist'
    $('sort').value = 'dist'
    near = 'show'
    renderHome()
    showUser(state.userPos, coveredBottom()) // sau renderHome: thẻ đã đổi cỡ
    toast('Đã xếp quán theo khoảng cách tới bạn')
  }, e => {
    near = state.userPos ? 'show' : e.code === 1 ? 'default' : 'ask'
    renderNear()
    toast(e.code === 1
      ? `Bạn chưa cho phép vị trí nên Bao tính từ ${defaultSpot().name}. Muốn bật lại thì vào cài đặt trình duyệt, cho phép vị trí cho trang này nhé`
      : 'Chưa lấy được vị trí. Ra chỗ thoáng hơn rồi bấm thử lại nhé')
  }, { timeout: 10000, maximumAge: 60000 })
}

// Số px ở đáy bản đồ bị ngăn kéo hoặc thẻ gợi ý che (điện thoại). Laptop: hai thứ này nằm cột bên trái, không che.
function coveredBottom() {
  const m = $('map').getBoundingClientRect()
  const over = ['sheet', 'near'].map(id => $(id).getBoundingClientRect()).filter(r => r.height && r.left < m.right && r.right > m.left)
  return Math.max(0, m.bottom - Math.min(m.bottom, ...over.map(r => r.top)))
}

// Đã cho phép từ trước thì lấy luôn (trình duyệt không hỏi lại). Chưa thì mời bằng thẻ, chỉ xin quyền khi người dùng bấm
// (xin ngay lúc mở trang thì Lighthouse trừ điểm và người dùng hay bấm chặn). Đã chặn thì không hỏi, gợi ý quanh vị trí mặc định.
async function initNear() {
  let s = navigator.geolocation ? 'prompt' : 'denied'
  try { s = (await navigator.permissions.query({ name: 'geolocation' })).state } catch {} // Safari cũ, trình duyệt trong app
  if (s === 'granted') return locate()
  near = s === 'denied' ? 'default' : 'ask'
  renderNear()
}

function placeItem(p) {
  const d = dist(p)
  const open = isOpenNow(p.opening_hours)
  return h('li', null, h('a', { href: `quan/${p.id}`, class: 'place-item' },
    p.cover_path
      ? h('img', { src: photoUrl(thumbPath(p.cover_path)), width: 64, height: 64, loading: 'lazy', decoding: 'async', alt: '', class: 'thumb' })
      : placeIcon(p),
    h('span', { class: 'info' },
      h('strong', null, p.name),
      h('span', { class: 'muted' }, [CATEGORIES[p.category].label, d != null && formatDistance(d)].filter(Boolean).join(' · ')),
      h('span', null,
        h('b', { class: 'price' }, priceShort(p, DEMO)), ' · ', scoreShort(p),
        open !== null && ' · ', open !== null && h('span', { class: open ? 'open' : 'muted' }, open ? 'Đang mở' : 'Đã đóng')),
    ),
  ))
}

function renderList(list = filtered()) {
  const ul = $('list')
  const shown = sorted(state.listMode || !state.inBounds ? list : list.filter(state.inBounds))
  const title = $('sheet-title')
  if (!state.places.length) {
    if (state.loading) {
      title.textContent = 'Đang tìm quán ngon…'
      ul.replaceChildren(h('li', { class: 'empty' }, mascot('doi', 72), h('p', null, 'Bao đang đi tìm quán…')))
    } else {
      title.textContent = 'Chưa tải được quán'
      ul.replaceChildren(h('li', null, errorBox('Không tải được danh sách quán. Kiểm tra mạng rồi bấm thử lại nhé.', loadData)))
    }
    return
  }
  title.textContent = shown.length
    ? `Đói chưa? Quanh đây có ${shown.length} quán ngon nè`
    : 'Chưa có quán nào khớp'
  if (!shown.length) {
    const hasFilter = state.q || state.price || state.open || state.cats.size
    ul.replaceChildren(h('li', { class: 'empty' }, mascot('buon', 72),
      h('p', null, hasFilter ? 'Chưa có quán nào khớp, thử bỏ bớt bộ lọc nhé.' : 'Vùng này chưa có quán. Kéo bản đồ sang chỗ khác nhé.'),
      hasFilter && h('button', { type: 'button', class: 'btn-ghost', onclick: clearFilters }, 'Bỏ lọc')))
    return
  }
  ul.replaceChildren(...shown.map(placeItem))
}

function clearFilters() {
  Object.assign(state, { q: '', price: null, open: false })
  state.cats.clear()
  $('q').value = ''
  for (const b of $('filters').querySelectorAll('[aria-pressed]:not(.lm-chip)')) b.setAttribute('aria-pressed', 'false')
  renderHome()
}

function showQuick(id) {
  const p = state.places.find(x => x.id === id)
  if (!p) return
  selectPin(id)
  const d = dist(p)
  const box = $('quick')
  const close = () => { box.hidden = true; selectPin(null) }
  box.replaceChildren(
    p.cover_path
      ? h('img', { src: photoUrl(thumbPath(p.cover_path)), width: 72, height: 72, alt: '', class: 'thumb' })
      : placeIcon(p, 44),
    h('div', { class: 'info' },
      h('strong', null, p.name),
      h('span', null, h('b', { class: 'price' }, priceShort(p, DEMO)), ' · ', scoreShort(p), d != null && ` · ${formatDistance(d)}`),
      h('a', { href: `quan/${p.id}`, class: 'btn btn-sm' }, 'Xem quán')),
    h('button', { type: 'button', class: 'close', 'aria-label': 'Đóng', onclick: close }, '×'),
  )
  box.hidden = false
}

function setListMode(on) {
  state.listMode = on
  $('home').classList.toggle('listmode', on)
  $('view-toggle').textContent = on ? 'Bản đồ' : 'Danh sách'
  $('view-toggle').hidden = state.mapFailed
  if (on) $('quick').hidden = true
  renderList()
}

let mapStarted = false
function startMap() {
  // Bản đồ cần khung đang hiện để đo kích thước; trang khác (vd /de-xuat) chưa cần tới.
  // Chưa có quán (Supabase lỗi hoặc chưa cấu hình) vẫn vẽ bản đồ để xem địa danh.
  if (mapStarted || appPath() !== '/') return
  if (!state.city) return askCity() // lần đầu mở app: hỏi thành phố trước, chọn xong mới vẽ bản đồ
  mapStarted = true
  const o = state.userPos ?? state.city.center
  const go = () => initMap($('map'), {
    center: { lat: o.lat, lng: o.lng },
    onSelect: showQuick,
    onIdle: pred => { state.inBounds = pred; renderList() },
    onFail: () => {
      state.mapFailed = true
      state.inBounds = null
      setListMode(true)
      toast('Bản đồ đang nghỉ, xem danh sách nhé')
    },
  }).then(() => {
    renderHome()
    if (state.userPos) showUser(state.userPos, coveredBottom()) // vị trí lấy xong trước khi bản đồ kịp vẽ
    // Địa danh: dữ liệu tĩnh lấy từ Wikidata/Wikipedia bằng scripts/landmarks.mjs. Lỗi thì bản đồ vẫn chạy, chỉ thiếu địa danh
    fetch('landmarks.json').then(r => r.json()).then(list => {
      showLandmarks(list, openLandmark)
      toggleLandmarks(state.landmarks)
    }, () => {})
  })
  // Bản đồ nặng nhất: vẽ khung trang và danh sách trước, nạp Maps JS sau
  ;(window.requestIdleCallback ?? (f => setTimeout(f, 200)))(go)
}

// Hỏi thành phố: lần đầu mở app, hoặc khi bấm nút thành phố trên thanh lọc.
// Bấm Esc lần đầu thì mở Hà Nội; đổi lại được bằng nút thành phố.
function askCity() {
  if (document.querySelector('.city-pick')) return
  const dlg = h('dialog', {
    class: 'sheet-dialog city-pick', 'aria-labelledby': 'city-title',
    onclose: () => {
      dlg.remove()
      const c = CITIES[dlg.returnValue] ?? state.city ?? CITIES[0]
      if (c !== state.city) setCity(c)
    },
  }, h('form', { method: 'dialog' },
    mascot('vui', 72),
    h('h2', { id: 'city-title' }, 'Bạn đang ở đâu?'),
    CITIES.map((c, i) => h('button', { class: 'btn btn-block', value: String(i) }, c.name)),
  ))
  document.body.append(dlg)
  dlg.showModal()
}

function setCity(c) {
  state.city = c
  try { localStorage.setItem(CITY_KEY, c.name) } catch {}
  $('city').textContent = `${c.name} ▾`
  renderHome()
  if (mapStarted) moveTo(c.center, 0) // 0: thu nhỏ nhất cho phép, nội thành phủ kín màn hình
  else startMap()
}

function setupHome() {
  const filters = $('filters')
  const chip = (label, onclick, icon) => h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick },
    icon && h('img', { src: icon, width: 22, height: 22, alt: '' }), label)
  const priceChip = (label, key) => chip(label, e => {
    state.price = state.price === key ? null : key
    for (const b of filters.querySelectorAll('[data-price]')) b.setAttribute('aria-pressed', String(b.dataset.price === state.price))
    renderHome()
  })
  const u30 = priceChip('Dưới 30k', 'u30')
  const p3050 = priceChip('30–50k', '30_50')
  u30.dataset.price = 'u30'
  p3050.dataset.price = '30_50'
  const openChip = chip('Đang mở', e => {
    state.open = !state.open
    e.currentTarget.setAttribute('aria-pressed', String(state.open))
    renderHome()
  })
  const cats = Object.entries(CATEGORIES).map(([key, c]) => chip(c.label, e => {
    state.cats.has(key) ? state.cats.delete(key) : state.cats.add(key)
    e.currentTarget.setAttribute('aria-pressed', String(state.cats.has(key)))
    renderHome()
  }, `icons/${key}.svg`))
  const lmChip = chip('Địa danh', e => {
    state.landmarks = !state.landmarks
    e.currentTarget.setAttribute('aria-pressed', String(state.landmarks))
    toggleLandmarks(state.landmarks)
  }, 'icons/lm-museum.svg')
  lmChip.classList.add('lm-chip')
  lmChip.setAttribute('aria-pressed', 'true')
  const cityChip = h('button', { type: 'button', id: 'city', class: 'chip', title: 'Đổi thành phố', onclick: askCity },
    `${state.city?.name ?? 'Thành phố'} ▾`)
  filters.append(cityChip, u30, p3050, openChip, lmChip, ...cats)
  $('q').oninput = e => { state.q = e.target.value; renderHome() }
  $('sort').onchange = e => { state.sort = e.target.value; renderList() }
  $('view-toggle').onclick = () => setListMode(!state.listMode)
  $('sheet-toggle').onclick = e => {
    const open = $('sheet').classList.toggle('open')
    e.currentTarget.setAttribute('aria-expanded', String(open))
  }
  $('locate').onclick = locate
}

// ───────── Router ─────────

function showHome() {
  document.title = TITLE
  $('page').hidden = true
  $('page').replaceChildren()
  $('home').hidden = false
  renderHome()
  startMap()
}

function renderAbout() {
  page('Về dự án', $('about').content.cloneNode(true))
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
}

const routes = [
  [/^\/$/, showHome],
  [/^\/quan\/(\d+)\/?$/, id => renderPlace(+id)],
  [/^\/quan\/(\d+)\/chi-duong\/?$/, id => renderDirections(+id)],
  [/^\/quan\/(\d+)\/danh-gia\/?$/, id => requireLogin('viết đánh giá', () => renderReview(+id))],
  [/^\/de-xuat\/?$/, () => requireLogin('đề xuất quán mới', renderSuggest)],
  [/^\/cua-toi\/?$/, () => requireLogin('xem đánh giá của bạn', renderMine)],
  [/^\/gioi-thieu\/?$/, renderAbout],
]

// Đường dẫn gốc của app: "/" khi chạy trên máy, "/alert/" trên GitHub Pages (thẻ <base> trong index.html)
const BASE = new URL(document.baseURI).pathname
// Đường dẫn của màn hiện tại, đã bỏ phần gốc: "/quan/12"
const appPath = () => '/' + location.pathname.slice(BASE.length)

export function route() {
  document.querySelector('details.menu')?.removeAttribute('open')
  for (const [re, fn] of routes) {
    const m = appPath().match(re)
    if (m) return fn(...m.slice(1))
  }
  page('Không tìm thấy', errorBox('Trang này không có. Quay lại bản đồ tìm quán khác nhé.'))
}

// path: tương đối theo <base> ("quan/12", "./") hoặc URL đầy đủ cùng trang
export function navigate(path, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState'](null, '', path)
  route()
}

// Link nội bộ (cùng trang, nằm dưới đường dẫn gốc) đổi màn tại chỗ, không tải lại trang
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]')
  if (!a || a.target || a.origin !== location.origin || !a.pathname.startsWith(BASE)) return
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  if (a.href !== location.href) navigate(a.href)
})
addEventListener('popstate', route)

// ───────── Khởi động ─────────

// Bản demo: hiện dòng "Bản demo" và các ghi chú chỉ dành cho bản demo (class .demo-only trong index.html)
document.documentElement.classList.toggle('demo', DEMO)
setupHome()
const cached = readCache()
if (cached) setData(cached)
initAuth()
loadData() // trước route(): mở thẳng link quán (vd /quan/12) lần đầu thì trang quán chờ được dữ liệu
route()
if (cached) startMap()
initNear()
