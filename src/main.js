// Router, trạng thái chung, bộ lọc, ngăn kéo danh sách, thẻ xem nhanh, trang Về dự án.
import './style.css'
import { readCache, fetchPlaces, photoUrl, thumbPath } from './supabase.js'
import { initMap, showPlaces, select as selectPin, moveTo, showUser, showLandmarks, toggleLandmarks } from './map.js'
import {
  CATEGORIES, h, normalizeVi, distanceM, isOpenNow, filterPrice, priceShort, scoreShort, formatDistance, placeLabel,
} from './util.js'
import { renderPlace, openLandmark } from './place.js'
import { renderReview, renderSuggest } from './review.js'
import { initAuth, requireLogin, renderMine } from './auth.js'

export const state = {
  places: [], areas: [], savedAt: null,
  area: null, q: '', price: null, open: false, cats: new Set(), sort: 'dist',
  userPos: null, // chỉ giữ trong bộ nhớ, không lưu
  inBounds: null, listMode: false, mapFailed: false, user: null, loading: false,
  landmarks: true, // hiện địa danh nổi tiếng trên bản đồ
}

const $ = id => document.getElementById(id)
const TITLE = document.title

// ───────── Tiện ích giao diện dùng chung ─────────

export const mascot = (mood, size = 96) =>
  h('img', { src: `/icons/bebao-${mood}.svg`, width: size, height: size, alt: '', class: 'mascot' })

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
    h('img', { src: `/icons/${p.category}.svg`, width: size, height: size, alt: '' }))

// Hiện một trang con (mọi màn trừ bản đồ). Bản đồ vẫn giữ nguyên phía sau để quay lại không phải vẽ lại.
export function page(title, nodes, back = { href: '/', label: 'Bản đồ' }) {
  document.title = `${title} · Quán Quen`
  $('home').hidden = true
  const main = $('page')
  main.hidden = false
  main.replaceChildren(h('a', { href: back.href, class: 'back' }, `‹ ${back.label}`), h('div', null, nodes))
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
  fillAreas()
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

export function currentArea() {
  return state.areas.find(a => a.id === state.area)
}

export function origin() {
  const a = currentArea() ?? state.areas[0]
  return state.userPos ?? (a ? { lat: a.center_lat, lng: a.center_lng } : null)
}

export function dist(p) {
  const o = origin()
  return o ? distanceM(o, p) : null
}

function fillAreas() {
  const sel = $('area')
  const fromUrl = +new URLSearchParams(location.search).get('khu')
  if (state.area === null) state.area = state.areas.some(a => a.id === fromUrl) ? fromUrl : (state.areas[0]?.id ?? 0)
  sel.replaceChildren(
    h('option', { value: '0' }, 'Tất cả cụm trường'),
    ...state.areas.map(a => h('option', { value: String(a.id) }, `Quanh: ${a.name}`)),
  )
  sel.value = String(state.area)
}

function filtered() {
  const q = normalizeVi(state.q.trim())
  return state.places.filter(p => {
    if (state.area && p.area_id !== state.area) return false
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
}

function placeItem(p) {
  const d = dist(p)
  const open = isOpenNow(p.opening_hours)
  return h('li', null, h('a', { href: `/quan/${p.id}`, class: 'place-item' },
    p.cover_path
      ? h('img', { src: photoUrl(thumbPath(p.cover_path)), width: 64, height: 64, loading: 'lazy', decoding: 'async', alt: '', class: 'thumb' })
      : placeIcon(p),
    h('span', { class: 'info' },
      h('strong', null, p.name),
      h('span', { class: 'muted' }, [CATEGORIES[p.category].label, d != null && formatDistance(d)].filter(Boolean).join(' · ')),
      h('span', null,
        h('b', { class: 'price' }, priceShort(p)), ' · ', scoreShort(p),
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
      ul.replaceChildren(h('li', { class: 'empty' }, mascot('doi', 72), h('p', null, 'Bé Bao đang đi tìm quán…')))
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
      h('p', null, hasFilter ? 'Chưa có quán nào khớp, thử bỏ bớt bộ lọc nhé.' : 'Vùng này chưa có quán. Kéo bản đồ hoặc chọn cụm trường khác nhé.'),
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
      h('span', null, h('b', { class: 'price' }, priceShort(p)), ' · ', scoreShort(p), d != null && ` · ${formatDistance(d)}`),
      h('a', { href: `/quan/${p.id}`, class: 'btn btn-sm' }, 'Xem quán')),
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
  // Bản đồ cần khung đang hiện để đo kích thước; trang khác (vd /de-xuat) chưa cần tới
  if (mapStarted || !state.places.length || location.pathname !== '/') return
  mapStarted = true
  const o = origin() ?? state.places[0]
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
    // Địa danh: dữ liệu tĩnh lấy từ Wikidata/Wikipedia bằng scripts/landmarks.mjs. Lỗi thì bản đồ vẫn chạy, chỉ thiếu địa danh
    fetch('/landmarks.json').then(r => r.json()).then(list => {
      showLandmarks(list, openLandmark)
      toggleLandmarks(state.landmarks)
    }, () => {})
  })
  // Bản đồ nặng nhất: vẽ khung trang và danh sách trước, nạp Maps JS sau
  ;(window.requestIdleCallback ?? (f => setTimeout(f, 200)))(go)
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
  }, `/icons/${key}.svg`))
  const lmChip = chip('Địa danh', e => {
    state.landmarks = !state.landmarks
    e.currentTarget.setAttribute('aria-pressed', String(state.landmarks))
    toggleLandmarks(state.landmarks)
  }, '/icons/lm-museum.svg')
  lmChip.classList.add('lm-chip')
  lmChip.setAttribute('aria-pressed', 'true')
  filters.append(u30, p3050, openChip, lmChip, ...cats)

  $('area').onchange = e => {
    state.area = +e.target.value
    history.replaceState(null, '', state.area ? `/?khu=${state.area}` : '/')
    const a = currentArea()
    if (a) moveTo({ lat: a.center_lat, lng: a.center_lng }, 15)
    renderHome()
  }
  $('q').oninput = e => { state.q = e.target.value; renderHome() }
  $('sort').onchange = e => { state.sort = e.target.value; renderList() }
  $('view-toggle').onclick = () => setListMode(!state.listMode)
  $('sheet-toggle').onclick = e => {
    const open = $('sheet').classList.toggle('open')
    e.currentTarget.setAttribute('aria-expanded', String(open))
  }
  $('locate').onclick = () => {
    if (!navigator.geolocation) return toast('Máy bạn không lấy được vị trí. App tính khoảng cách từ tâm cụm trường nhé')
    toast('Đang lấy vị trí…')
    navigator.geolocation.getCurrentPosition(g => {
      state.userPos = { lat: g.coords.latitude, lng: g.coords.longitude }
      showUser(state.userPos)
      state.sort = 'dist'
      $('sort').value = 'dist'
      renderHome()
      toast('Đã xếp quán theo khoảng cách tới bạn')
    }, e => toast(e.code === 1
      ? 'Bạn chưa cho phép vị trí. App vẫn tính khoảng cách từ tâm cụm trường nhé'
      : 'Chưa lấy được vị trí, thử lại sau nhé'), { timeout: 10000, maximumAge: 60000 })
  }
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
  [/^\/quan\/(\d+)\/danh-gia\/?$/, id => requireLogin('viết đánh giá', () => renderReview(+id))],
  [/^\/de-xuat\/?$/, () => requireLogin('đề xuất quán mới', renderSuggest)],
  [/^\/cua-toi\/?$/, () => requireLogin('xem đánh giá của bạn', renderMine)],
  [/^\/gioi-thieu\/?$/, renderAbout],
]

export function route() {
  document.querySelector('details.menu')?.removeAttribute('open')
  for (const [re, fn] of routes) {
    const m = location.pathname.match(re)
    if (m) return fn(...m.slice(1))
  }
  page('Không tìm thấy', errorBox('Trang này không có. Quay lại bản đồ tìm quán khác nhé.'))
}

export function navigate(path, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState'](null, '', path)
  route()
}

document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="/"]')
  if (!a || a.target || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  const href = a.getAttribute('href')
  if (href !== location.pathname + location.search + location.hash) navigate(href)
})
addEventListener('popstate', route)

// ───────── Khởi động ─────────

setupHome()
const cached = readCache()
if (cached) setData(cached)
initAuth()
route()
if (cached) startMap()
loadData()
