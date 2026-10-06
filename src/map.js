// File duy nhất biết đến thư viện bản đồ. Leaflet + protomaps-leaflet tự vẽ bản đồ kiểu chibi từ dữ liệu
// vector của OpenFreeMap (miễn phí, không key, không giới hạn lượt; kiểm 06/10/2026, vào được từ Việt Nam).
// Không dùng openstreetmap.org: không kết nối được từ mạng ở Việt Nam.
import { CATEGORIES, CITIES, cityOf, isOpenNow, isTopPlace } from './util.js'

const TILEJSON = 'https://tiles.openfreemap.org/planet'
const ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
const CELL = 64 // px: các quán gần nhau hơn khoảng này trên màn hình thì gộp thành cụm
const FONT = '"Be Vietnam Pro", system-ui, sans-serif'
const dark = matchMedia('(prefers-color-scheme: dark)')
// Khung nội thành chứa điểm p, ngoài cả hai thành phố thì undefined
const boxOf = (L, p) => {
  const c = cityOf(L.latLng(p))
  return c && L.latLngBounds(c.box)
}
// Thu nhỏ hết cỡ vẫn nằm gọn trong khung nội thành, không lộ ra tỉnh lân cận. Tính lại khi đổi thành phố hay đổi cỡ khung.
function fitCity(m) {
  if (!m.getSize().x) return // khung đang ẩn: chưa đo được
  m.options.minZoom = 0 // getBoundsZoom không trả về mức nhỏ hơn minZoom hiện tại
  m.setMinZoom(m.getBoundsZoom(m.options.maxBounds, true))
}

let lib // Promise<{ L, pm, tiles }>
let map, layer, lmLayer, userMarker, selectedId, onSelectCb
let current = [] // marker của các quán đang lọc
const markers = new Map() // place.id -> L.Marker

// Thư viện chỉ tải khi cần bản đồ: không chặn lần vẽ đầu của khung trang và danh sách
const loadLib = () => (lib ??= (async () => {
  const [L, , tilejson] = await Promise.all([
    import('leaflet/dist/leaflet-src.esm.js'),
    import('leaflet/dist/leaflet.css'),
    fetch(TILEJSON).then(r => r.json()), // đường dẫn ô dữ liệu đổi theo mỗi bản cập nhật của OpenFreeMap
    document.fonts?.load(`800 14px ${FONT}`), // chữ trên bản đồ vẽ bằng canvas: font phải tải xong trước
  ])
  window.L = L // protomaps-leaflet dùng biến toàn cục L
  const pm = await import('protomaps-leaflet')
  return { L, pm, tiles: tilejson.tiles[0] }
})())

// ───────── Kiểu bản đồ chibi: màu kẹo, đường to bo tròn, viền dày như hình dán ─────────

const PALETTE = {
  light: {
    land: '#FFFBF2', residential: '#FFF6E8', commercial: '#FFEFF3', campus: '#F3EDFF', hospital: '#FFEEF3',
    grass: '#CFF7C8', wood: '#BDF0B0', water: '#C9EEFF', waterEdge: '#8ED8FA',
    building: '#FFEADF', buildingEdge: '#FFD0B8',
    minorCase: '#F1E2CF', minor: '#FFFFFF', midCase: '#FFD27A', mid: '#FFF6D1', bigCase: '#FFB3B3', big: '#FFE3E3',
    rail: '#D3C2FA', path: '#EBD6B8',
    text: '#6B4430', halo: '#FFFFFF', roadText: '#7A5644', waterText: '#1F78B4', campusText: '#6A4BC4',
  },
  dark: {
    land: '#3A3358', residential: '#40385F', commercial: '#4A3A5C', campus: '#463A72', hospital: '#4D3858',
    grass: '#3B6150', wood: '#355847', water: '#3E6A9E', waterEdge: '#6A98CF',
    building: '#4E4470', buildingEdge: '#6E5E98',
    minorCase: '#544A78', minor: '#6E6399', midCase: '#A9864D', mid: '#C9A46A', bigCase: '#AD6278', big: '#CF8AA0',
    rail: '#8A77C4', path: '#6F6394',
    text: '#FFF6EC', halo: '#3A3358', roadText: '#F1E6DA', waterText: '#B5DBFA', campusText: '#DCCBFF',
  },
}

function rules(pm, c) {
  const { PolygonSymbolizer: Poly, LineSymbolizer: Line, CenteredTextSymbolizer: Text, LineLabelSymbolizer: LineText, linear } = pm
  const is = (...v) => (z, f) => v.includes(f.props.class)
  const road = (classes, caseColor, color, width) => [
    { dataLayer: 'transportation', filter: is(...classes), symbolizer: new Line({ color: caseColor, width: z => width(z) + 3, lineCap: 'round', lineJoin: 'round' }) },
    { dataLayer: 'transportation', filter: is(...classes), symbolizer: new Line({ color, width, lineCap: 'round', lineJoin: 'round' }) },
  ]
  const minorW = linear([[13, 1], [15, 4], [17, 11], [19, 26]])
  const midW = linear([[11, 1.5], [14, 5], [16, 10], [18, 22], [19, 32]])
  const bigW = linear([[10, 2], [14, 7], [16, 13], [18, 28], [19, 40]])
  const halo = (font, fill) => ({ font, fill, stroke: c.halo, width: 3 })

  const paintRules = [
    { dataLayer: 'landuse', filter: is('residential', 'neighbourhood'), symbolizer: new Poly({ fill: c.residential }) },
    { dataLayer: 'landuse', filter: is('commercial', 'retail'), symbolizer: new Poly({ fill: c.commercial }) },
    { dataLayer: 'landuse', filter: is('school', 'university', 'college', 'kindergarten'), symbolizer: new Poly({ fill: c.campus }) },
    { dataLayer: 'landuse', filter: is('hospital'), symbolizer: new Poly({ fill: c.hospital }) },
    { dataLayer: 'landcover', filter: is('grass', 'farmland', 'wetland'), symbolizer: new Poly({ fill: c.grass }) },
    { dataLayer: 'landcover', filter: is('wood'), symbolizer: new Poly({ fill: c.wood }) },
    { dataLayer: 'park', symbolizer: new Poly({ fill: c.grass }) },
    { dataLayer: 'landuse', filter: is('park', 'pitch', 'playground', 'cemetery', 'garden'), symbolizer: new Poly({ fill: c.grass }) },
    { dataLayer: 'water', symbolizer: new Poly({ fill: c.water, stroke: c.waterEdge, width: 2 }) },
    { dataLayer: 'waterway', symbolizer: new Line({ color: c.water, width: linear([[12, 1], [16, 5], [19, 12]]), lineCap: 'round', lineJoin: 'round' }) },
    { dataLayer: 'building', minzoom: 16, symbolizer: new Poly({ fill: c.building, stroke: c.buildingEdge, width: 1 }) }, // sớm hơn thì nhà thành chấm li ti, rối mắt
    { dataLayer: 'transportation', filter: is('path', 'track'), minzoom: 15, symbolizer: new Line({ color: c.path, width: 2, dash: [3, 4], lineCap: 'round' }) },
    ...road(['minor', 'service'], c.minorCase, c.minor, minorW),
    ...road(['tertiary', 'secondary', 'primary'], c.midCase, c.mid, midW),
    ...road(['trunk', 'motorway'], c.bigCase, c.big, bigW),
    { dataLayer: 'transportation', filter: is('rail', 'transit'), symbolizer: new Line({ color: c.rail, width: 3, dash: [6, 5], lineCap: 'round' }) },
  ]
  const name = { labelProps: ['name:vi', 'name'] }
  const labelRules = [
    { dataLayer: 'place', filter: is('city', 'town'), maxzoom: 13, symbolizer: new Text({ ...name, ...halo(`800 18px ${FONT}`, c.text) }) },
    { dataLayer: 'place', filter: is('suburb', 'quarter', 'neighbourhood'), minzoom: 12, symbolizer: new Text({ ...name, ...halo(`800 14px ${FONT}`, c.text) }) },
    { dataLayer: 'poi', filter: is('college'), minzoom: 13, symbolizer: new Text({ ...name, ...halo(`800 13px ${FONT}`, c.campusText) }) },
    { dataLayer: 'water_name', minzoom: 13, symbolizer: new Text({ ...name, ...halo(`italic 600 13px ${FONT}`, c.waterText) }) },
    { dataLayer: 'transportation_name', minzoom: 14, symbolizer: new LineText({ ...name, ...halo(`600 13px ${FONT}`, c.roadText) }) },
  ]
  return { paintRules, labelRules, backgroundColor: c.land }
}

function newMap({ L, pm, tiles }, el, center, zoom) {
  const city = boxOf(L, center) ?? L.latLngBounds(CITIES[0].box) // ở ngoài cả hai thành phố thì mở Hà Nội
  const m = L.map(el, { zoomControl: false, attributionControl: false, maxZoom: 19, maxBounds: city, maxBoundsViscosity: 1 })
  fitCity(m) // trước setView: zoom mở đầu nhỏ hơn mức vừa khung thì tự nâng lên
  m.setView(city.contains(center) ? center : city.getCenter(), zoom)
  m.on('resize', () => fitCity(m))
  L.control.zoom({ position: 'topright', zoomInTitle: 'Phóng to', zoomOutTitle: 'Thu nhỏ' }).addTo(m)
  // Ghi nguồn ở góc trên: góc dưới bị ngăn kéo danh sách che, mà điều khoản bắt buộc ghi nguồn
  L.control.attribution({ prefix: false, position: 'topleft' }).addTo(m)
  let base
  const draw = () => {
    base?.remove()
    base = pm.leafletLayer({ url: tiles, maxDataZoom: 14, attribution: ATTRIBUTION, ...rules(pm, PALETTE[dark.matches ? 'dark' : 'light']) }).addTo(m)
    base.bringToBack()
    return base
  }
  const first = draw()
  dark.addEventListener('change', draw) // máy đổi chế độ sáng/tối khi đang mở app thì đổi theo
  return { m, base: first }
}

function img(src, size) {
  const i = document.createElement('img')
  i.src = src
  i.width = i.height = size
  i.alt = ''
  return i
}

// Ghim chibi: đầu tròn phồng, viền trắng dày, bóng dưới chân, lắc lư nhẹ
function pinEl(category, iconSrc) {
  const el = document.createElement('div')
  el.className = 'pin'
  el.style.setProperty('--c', CATEGORIES[category]?.color ?? '#FF8FB1')
  el.style.setProperty('--d', `${(Math.random() * 2).toFixed(2)}s`) // lệch nhịp để các ghim không lắc cùng lúc
  const head = document.createElement('span')
  head.className = 'pin-head'
  head.append(img(iconSrc ?? `icons/${category}.svg`, 30))
  el.append(head)
  return el
}

function clusterEl(group) {
  const tally = {}
  for (const m of group) tally[m.qqCat] = (tally[m.qqCat] ?? 0) + 1
  const top = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0]
  const el = document.createElement('div')
  el.className = 'cluster'
  const n = document.createElement('b')
  n.textContent = group.length
  el.append(img(`icons/${top}.svg`, 30), n)
  return el
}

const setLabel = (m, label) => {
  m.options.title = label
  m.getElement()?.setAttribute('title', label)
  m.getElement()?.setAttribute('aria-label', label)
}

// Gom cụm theo lưới điểm ảnh ở mức zoom hiện tại.
// ponytail: lưới cố định, đủ cho vài trăm quán; quán nằm sát mép ô có thể không gộp với quán bên kia mép. Nhiều quán hơn thì dùng leaflet.markercluster.
function recluster() {
  if (!map) return
  const L = map.qqL
  layer.clearLayers()
  const z = map.getZoom()
  const cells = new Map()
  for (const m of current) {
    const p = map.project(m.getLatLng(), z)
    const key = z >= 18 ? m.qqId : `${Math.floor(p.x / CELL)}:${Math.floor(p.y / CELL)}` // zoom sát thì không gộp nữa
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key).push(m)
  }
  for (const group of cells.values()) {
    if (group.length === 1) {
      layer.addLayer(group[0])
      continue
    }
    const bounds = L.latLngBounds(group.map(m => m.getLatLng()))
    const c = L.marker(bounds.getCenter(), {
      icon: L.divIcon({ html: clusterEl(group), className: 'qq-icon', iconSize: [64, 52], iconAnchor: [32, 26] }),
      title: `${group.length} quán, bấm để phóng to`, zIndexOffset: 500,
    })
    c.on('click', () => map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 }))
    layer.addLayer(c)
  }
}

// Vẽ bản đồ. onFail được gọi một lần khi không có bản đồ (mất mạng, bị chặn, 8 giây chưa vẽ được ô bản đồ nào).
export async function initMap(el, { center, onSelect, onIdle, onFail }) {
  let failed = false
  const fail = () => { if (!failed) { failed = true; onFail() } }
  let tilesOk = false
  // Chỉ tính là lỗi khi khung bản đồ đang hiện (người dùng có thể đã sang trang khác)
  const watchdog = () => { if (!tilesOk) el.getClientRects().length ? fail() : setTimeout(watchdog, 8000) }
  setTimeout(watchdog, 8000)
  try {
    const lb = await loadLib()
    const { m, base } = newMap(lb, el, center, 0) // 0: mở ở mức thu nhỏ nhất cho phép, nội thành phủ kín màn hình
    map = m
    map.qqL = lb.L
    onSelectCb = onSelect
    layer = lb.L.layerGroup().addTo(map)
    lmLayer = lb.L.layerGroup().addTo(map)
    base.on('tileload', () => { tilesOk = true })
    map.on('zoomend', () => { recluster(); placeLandmarks() })
    map.on('moveend', () => {
      const b = map.getBounds()
      onIdle(p => b.contains([p.lat, p.lng]))
    })
    // Khung bản đồ đổi cỡ (xoay máy, quay lại từ trang khác) thì Leaflet cần đo lại
    new ResizeObserver(() => map.invalidateSize()).observe(el)
  } catch (err) {
    console.error(err)
    fail()
  }
}

// Hiện đúng các quán đã lọc; marker tạo một lần rồi dùng lại. label(p) là nhãn đọc màn hình.
export function showPlaces(places, label) {
  if (!map) return
  const L = map.qqL
  const now = new Date()
  current = places.map(p => {
    let m = markers.get(p.id)
    if (!m) {
      m = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ html: pinEl(p.category), className: 'qq-icon', iconSize: [48, 60], iconAnchor: [24, 58] }),
        riseOnHover: true,
      })
      m.qqId = p.id
      m.qqCat = p.category
      m.on('click', () => onSelectCb(p.id))
      m.on('add', () => setLabel(m, m.options.title))
      markers.set(p.id, m)
    }
    const pin = m.options.icon.options.html
    pin.classList.toggle('top', isTopPlace(p))
    pin.classList.toggle('closed', isOpenNow(p.opening_hours, now) === false)
    setLabel(m, label(p))
    return m
  })
  recluster()
}

// Địa danh nổi tiếng: ghim vàng, icon theo loại (chùa, nhà thờ, cầu…), không gộp cụm với quán, nằm dưới ghim quán.
// Thu nhỏ bản đồ chỉ hiện các địa danh nổi tiếng nhất của mỗi thành phố (l.order nhỏ), phóng to dần hiện thêm.
let lmMarkers = [] // [{ l, m }]
const lmLimit = z => (z <= 12 ? 5 : z === 13 ? 12 : z === 14 ? 25 : Infinity)

function placeLandmarks() {
  if (!lmLayer) return
  const n = lmLimit(map.getZoom())
  lmLayer.clearLayers()
  for (const { l, m } of lmMarkers) if (l.order < n) lmLayer.addLayer(m)
}

export function showLandmarks(list, onPick) {
  if (!map) return
  const L = map.qqL
  lmMarkers = list.map(l => {
    const el = pinEl('', `icons/lm-${l.type}.svg`)
    el.classList.add('lm')
    const m = L.marker([l.lat, l.lng], {
      icon: L.divIcon({ html: el, className: 'qq-icon', iconSize: [48, 60], iconAnchor: [24, 58] }),
      title: `Địa danh: ${l.name}`, zIndexOffset: -500 - l.order, riseOnHover: true,
    })
    m.on('click', () => onPick(l))
    m.on('add', () => setLabel(m, m.options.title))
    return { l, m }
  })
  placeLandmarks()
}

export function toggleLandmarks(on) {
  if (!map || !lmLayer) return
  if (on) lmLayer.addTo(map)
  else lmLayer.remove()
}

// Dời bản đồ tới điểm p; điểm ở thành phố kia thì đổi khung giới hạn trước, ngoài cả hai thành phố thì để yên
function goTo(m, p, zoom) {
  const city = boxOf(m.qqL, p)
  if (!city) return
  if (!city.equals(m.options.maxBounds)) {
    m.setMaxBounds(city)
    fitCity(m)
  }
  m.setView(p, zoom ?? m.getZoom())
}

const pinOf = id => markers.get(id)?.options.icon.options.html

export function select(id) {
  pinOf(selectedId)?.classList.remove('sel')
  markers.get(selectedId)?.setZIndexOffset(0)
  selectedId = id
  const m = markers.get(id)
  if (!m || !map) return
  pinOf(id).classList.add('sel')
  m.setZIndexOffset(1000)
  goTo(map, m.getLatLng())
}

export function moveTo(center, zoom) {
  if (map) goTo(map, [center.lat, center.lng], zoom)
}

// Vị trí của bạn: Bao nhỏ có vòng sóng
function meMarker(L, pos) {
  const me = document.createElement('div')
  me.className = 'me'
  me.append(img('icons/bebao-vui.svg', 30))
  return L.marker(pos, {
    icon: L.divIcon({ html: me, className: 'qq-icon', iconSize: [36, 36], iconAnchor: [18, 18] }),
    title: 'Vị trí của bạn', keyboard: false, interactive: false, zIndexOffset: 2000,
  })
}

// padBottom: số px ở đáy bản đồ bị thẻ che, để vị trí nằm giữa phần còn thấy
export function showUser(pos, padBottom = 0) {
  if (!map) return
  userMarker ??= meMarker(map.qqL, pos).addTo(map)
  userMarker.setLatLng(pos)
  // Ngoài khung thành phố đang xem thì không dời (main.js đổi thành phố trước nếu bạn đang ở thành phố kia)
  if (map.options.maxBounds.contains(pos)) map.panTo(map.unproject(map.project(pos).add([0, padBottom / 2])))
}

// Theo dõi liên tục: chỉ dời Bao, không kéo bản đồ (người dùng có thể đang xem chỗ khác)
export const moveUser = pos => userMarker?.setLatLng(pos)

// Bản đồ chỉ đường: ghim quán, vị trí của bạn, đường đi kiểu nét kẹo viền trắng.
// Trả về { user(pos), route([[lat, lng], ...]) } hoặc null nếu không tải được bản đồ.
export async function routeMap(el, place) {
  try {
    const lb = await loadLib()
    const { L } = lb
    const { m } = newMap(lb, el, [place.lat, place.lng], 16)
    L.marker([place.lat, place.lng], {
      icon: L.divIcon({ html: pinEl(place.category), className: 'qq-icon', iconSize: [48, 60], iconAnchor: [24, 58] }),
      title: place.name, keyboard: false, interactive: false, zIndexOffset: 1000,
    }).addTo(m)
    const me = meMarker(L, [place.lat, place.lng])
    const line = L.layerGroup().addTo(m)
    new ResizeObserver(() => m.invalidateSize()).observe(el)
    let raf = 0 // khung hình đang chạy của phương tiện
    let touchedAt = 0 // lần cuối người dùng tự kéo hoặc zoom bản đồ
    for (const ev of ['pointerdown', 'wheel']) el.addEventListener(ev, () => { touchedAt = Date.now() }, { passive: true })
    return {
      // Bản đồ theo bạn: chỉ dời khi Bao sắp ra khỏi khung (giữ nguyên khung cả tuyến khi còn thấy),
      // và không giành lại bản đồ trong 15 giây sau khi bạn tự kéo hoặc zoom để xem chỗ khác
      user: pos => {
        me.setLatLng(pos)
        if (!m.hasLayer(me)) me.addTo(m)
        if (Date.now() - touchedAt > 15000) m.panInside(pos, { padding: [60, 60] })
      },
      // Vẽ đường. Có mode thì phương tiện chạy dọc tuyến từ điểm đi tới quán, nét đường mọc dần phía sau, quay đầu theo
      // hướng đi (kiểu máy bay bay trên bản đồ); đoạn chưa tới là chấm mờ. Vẫn chạy khi máy bật giảm chuyển động: chỉ chạy khi
      // người dùng chọn cách đi, tối đa 5 giây, bản đồ đứng yên; khi đó CSS tắt hiệu ứng nhún.
      route: (pts, mode) => {
        cancelAnimationFrame(raf)
        line.clearLayers()
        m.fitBounds(L.latLngBounds(pts), { padding: [48, 48] })
        const style = { lineCap: 'round', lineJoin: 'round', interactive: false }
        const ride = mode && pts.length > 1
        if (ride) line.addLayer(L.polyline(pts, { ...style, color: '#C2410C', weight: 4, opacity: 0.45, dashArray: '1 10' }))
        const casing = L.polyline(ride ? [pts[0]] : pts, { ...style, color: '#FFFFFF', weight: 11 }).addTo(line)
        const core = L.polyline(ride ? [pts[0]] : pts, { ...style, color: '#C2410C', weight: 6 }).addTo(line)
        if (!ride) return
        const cum = [0] // quãng đường cộng dồn tới từng điểm (m): xe chạy đều dù các điểm cách nhau không đều
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + m.distance(pts[i - 1], pts[i]))
        const total = cum.at(-1) || 1
        // Điểm trên tuyến cách điểm đầu d mét, kèm chỉ số điểm kế tiếp
        const at = d => {
          let i = 1
          while (i < pts.length - 1 && cum[i] < d) i++
          const k = cum[i] > cum[i - 1] ? Math.min(1, (d - cum[i - 1]) / (cum[i] - cum[i - 1])) : 1
          return [[pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k], i]
        }
        const icon = document.createElement('div')
        icon.className = 'ride'
        icon.append(img(`icons/mode-${mode}.svg`, 44))
        const car = L.marker(pts[0], {
          icon: L.divIcon({ html: icon, className: 'qq-icon', iconSize: [48, 48], iconAnchor: [24, 42] }),
          keyboard: false, interactive: false, zIndexOffset: 1500,
        }).addTo(line)
        const t0 = performance.now(), dur = Math.min(5000, 2000 + total / 2) // 1 km chạy 2,5 giây, tối đa 5 giây
        const step = now => {
          const f = Math.min(1, (now - t0) / dur)
          const e = f < 0.5 ? 2 * f * f : 1 - (2 - 2 * f) ** 2 / 2 // chậm lúc xuất phát và lúc tới, nhanh ở giữa
          const [head, i] = at(total * e)
          const [ahead] = at(total * (e + 0.04)) // nhìn trước một đoạn để xe không lật qua lật lại ở ngõ ngoằn ngoèo
          if (Math.abs(ahead[1] - head[1]) > 1e-6) icon.classList.toggle('left', ahead[1] < head[1])
          const done = [...pts.slice(0, i), head]
          casing.setLatLngs(done)
          core.setLatLngs(done)
          car.setLatLng(head)
          if (f < 1) raf = requestAnimationFrame(step)
          else {
            icon.classList.add('done') // tới quán: mờ dần, nhường chỗ cho ghim quán
            setTimeout(() => line.removeLayer(car), 600)
          }
        }
        raf = requestAnimationFrame(step)
      },
    }
  } catch (err) {
    console.error(err)
    return null
  }
}

// Bản đồ nhỏ có ghim kéo được, cho form đề xuất quán. Trả về { get, set } hoặc null nếu không tải được.
export async function pickLocation(el, start) {
  try {
    const lb = await loadLib()
    const { m } = newMap(lb, el, [start.lat, start.lng], 17)
    m.qqL = lb.L
    const pin = lb.L.marker(m.getCenter(), {
      icon: lb.L.divIcon({ html: pinEl('', 'icons/bebao-vui.svg'), className: 'qq-icon', iconSize: [48, 60], iconAnchor: [24, 58] }),
      draggable: true, autoPan: true, title: 'Ghim vị trí quán: kéo ghim hoặc chạm vào bản đồ để dời',
    }).addTo(m)
    m.on('click', e => pin.setLatLng(e.latlng))
    new ResizeObserver(() => m.invalidateSize()).observe(el)
    return {
      get: () => {
        const { lat, lng } = pin.getLatLng()
        return { lat, lng }
      },
      set: pos => { pin.setLatLng(pos); goTo(m, pos) },
    }
  } catch {
    return null
  }
}
