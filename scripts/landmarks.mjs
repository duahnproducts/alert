// Lấy các địa danh nổi tiếng kèm ảnh thật từ Wikidata, Wikimedia Commons và Wikipedia tiếng Việt,
// ghi ra public/landmarks.json để app hiện trên bản đồ. Chạy lại khi muốn cập nhật: node scripts/landmarks.mjs
// Không dùng Google: Places API cần thẻ thanh toán và cấm lưu lại dữ liệu, ảnh.
//
// "Nổi tiếng" = có bài viết ở nhiều ngôn ngữ Wikipedia (số sitelinks). Chỉ giữ địa danh có ảnh chụp (JPEG)
// và thuộc loại công trình hoặc nơi chốn; bỏ sự kiện, tổ chức, đơn vị hành chính, sân bay, bệnh viện, nhà ga, trại giam (trừ trại giam đã thành bảo tàng).
import { writeFileSync } from 'node:fs'

const CITIES = [
  { city: 'Hà Nội', lng: 105.8521, lat: 21.0285, km: 10 }, // tâm: hồ Hoàn Kiếm
  { city: 'TP. Hồ Chí Minh', lng: 106.6980, lat: 10.7725, km: 10 }, // tâm: chợ Bến Thành
]
const PER_CITY = 50
const MIN_SITELINKS = 3
// Loại được tính là địa danh (gồm cả các lớp con): tòa nhà, công trình kiến trúc, tượng đài, bảo tàng,
// công viên, hồ, quảng trường, điểm du lịch, di chỉ khảo cổ, di tích, chợ, nơi thờ tự, vườn, sở thú, tượng, khu chợ, thành cổ
const KINDS = ['Q41176', 'Q811979', 'Q4989906', 'Q33506', 'Q22698', 'Q23397', 'Q174782', 'Q570116', 'Q839954', 'Q1081138', 'Q37654', 'Q1370598', 'Q1107656', 'Q43501', 'Q179700', 'Q330284', 'Q88291']

// Loại địa danh để chọn icon (public/icons/lm-<loại>.svg, bộ icon tự vẽ). Đoán theo tên tiếng Việt trước, không khớp thì theo
// tên lớp tiếng Anh trên Wikidata (P31); thứ tự trong mảng là thứ tự ưu tiên. Không khớp gì thì dùng 'museum' (tòa nhà cổ điển).
const TYPES = [
  ['zoo', /^(thảo cầm viên|vườn thú|sở thú)/i, /\bzoo\b/i],
  ['palace', /^(dinh|phủ chủ tịch|hoàng thành|thành cổ)/i, /palace|castle|citadel/i],
  ['temple', /^(nhà thờ hồi giáo|chùa|đền|đình|miếu|phủ|hội quán|văn miếu|thiền viện|tịnh xá|thánh thất)/i, /temple|pagoda|shrine|mosque|monastery/i],
  ['church', /^(nhà thờ|thánh đường|tu viện)/i, /church|cathedral|basilica|chapel/i],
  ['museum', /^(bảo tàng|nhà tù|nhà trưng bày)/i, /museum|gallery/i],
  ['lake', /^(hồ (?!chí minh)|sông|kênh|rạch|bến)/i, /lake|river|pond|reservoir|canal/i],
  ['park', /^(công viên|vườn)/i, /park|garden/i],
  ['bridge', /^(cầu|hầm|đường hầm)\s/i, /bridge|tunnel/i],
  ['theatre', /^(nhà hát|rạp|nhà văn hóa)/i, /theat(re|er)|opera|cinema|concert/i],
  ['stadium', /^(sân vận động|nhà thi đấu|cung thể thao|cung điền kinh|trung tâm thể thao)/i, /stadium|arena|sports/i],
  ['market', /^(chợ|trung tâm thương mại|phố mua sắm)/i, /market|shopping/i],
  ['post', /^bưu điện/i, /post office/i],
  ['hotel', /^khách sạn/i, /hotel/i],
  ['street', /^(con đường|phố|đường|ngõ|hẻm)\s/i, /street|road|avenue|boulevard|pedestrian/i],
  ['school', /^(trường|đại học|học viện|viện)\s/i, /school|university|college|academy/i],
  ['monument', /^(lăng|tượng|đài|cột|tháp|quảng trường|nhà tưởng niệm|khu tưởng niệm|nghĩa trang)/i, /monument|memorial|mausoleum|statue|square|flag|cemetery/i],
  ['tower', /^(landmark|tòa|bitexco|lotte|vincom|keangnam|saigon centre|times square)/i, /skyscraper|office|tower|high-rise|building complex/i],
]
const typeOf = (name, classes) =>
  TYPES.find(([, byName]) => byName.test(name))?.[0] ?? TYPES.find(([, , byClass]) => byClass.test(classes))?.[0] ?? 'museum'
const UA = { 'User-Agent': 'Hometown-landmarks/1.0 (student contest project; https://github.com/duahnproducts/alert)' }
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function json(url, opts = {}) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { ...opts, headers: { ...UA, ...opts.headers } })
    if (r.ok) return r.json()
    await sleep(2000 * (i + 1))
  }
  throw new Error(`Không lấy được ${url.slice(0, 80)}…`)
}

const sparql = ({ lng, lat, km }) => `
SELECT ?item (SAMPLE(COALESCE(?vi, ?en)) AS ?name) (SAMPLE(?descr) AS ?desc) (SAMPLE(?c) AS ?coord) (SAMPLE(?img) AS ?image)
       (SAMPLE(?links) AS ?sitelinks) (SAMPLE(?art) AS ?article) (GROUP_CONCAT(DISTINCT ?clsName; separator="|") AS ?classes) WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?c . bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${km}" . }
  ?item wdt:P18 ?img ; wikibase:sitelinks ?links .
  FILTER(?links >= ${MIN_SITELINKS})
  FILTER(REGEX(STR(?img), "\\\\.(jpe?g)$", "i"))
  VALUES ?kind { ${KINDS.map(k => 'wd:' + k).join(' ')} }
  FILTER EXISTS { ?item wdt:P31/wdt:P279* ?kind }
  # Bỏ đơn vị hành chính (phường, quận…), trừ khi đồng thời là công trình, thành cổ hay tượng đài:
  # cây phân loại của Wikidata nối "citadel" lên đơn vị hành chính, nên Hoàng thành Thăng Long từng bị bỏ nhầm
  FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q56061 . FILTER NOT EXISTS { VALUES ?keep { wd:Q811979 wd:Q88291 wd:Q4989906 } ?item wdt:P31/wdt:P279* ?keep } }
  FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q1248784 }
  FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q16917 }
  FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q12819564 }
  FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q40357 . FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q33506 } }
  OPTIONAL { ?art schema:about ?item ; schema:isPartOf <https://vi.wikipedia.org/> }
  OPTIONAL { ?item rdfs:label ?vi . FILTER(LANG(?vi) = "vi") }
  OPTIONAL { ?item rdfs:label ?en . FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item schema:description ?descr . FILTER(LANG(?descr) = "vi") }
  OPTIONAL { ?item wdt:P31 ?cls . ?cls rdfs:label ?clsName . FILTER(LANG(?clsName) = "en") }
} GROUP BY ?item ORDER BY DESC(?sitelinks) LIMIT ${PER_CITY * 2}`

const stripHtml = s => (s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().replace(/[\s:;,.-]+$/, '')

async function credits(files) {
  const out = {}
  for (let i = 0; i < files.length; i += 40) {
    const titles = files.slice(i, i + 40).map(f => 'File:' + f).join('|')
    const j = await json('https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo' +
      '&iiprop=url|size|extmetadata&iiurlwidth=800&iiextmetadatafilter=Artist|LicenseShortName|LicenseUrl&titles=' + encodeURIComponent(titles))
    for (const p of j.query.pages) {
      const ii = p.imageinfo?.[0]
      if (!ii) continue
      const m = ii.extmetadata ?? {}
      out[p.title.replace(/^File:/, '')] = {
        src: (ii.thumburl ?? ii.url).replace(/\?utm_.*$/, ''), w: ii.thumbwidth ?? ii.width, h: ii.thumbheight ?? ii.height,
        author: stripHtml(m.Artist?.value) || 'Không rõ tác giả',
        license: stripHtml(m.LicenseShortName?.value) || 'Xem trang ảnh',
        licenseUrl: m.LicenseUrl?.value ?? null,
        page: ii.descriptionurl,
      }
    }
  }
  return out
}

async function extracts(titles) {
  const out = {}
  for (let i = 0; i < titles.length; i += 20) {
    const j = await json('https://vi.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=extracts' +
      '&exintro=1&explaintext=1&exsentences=3&redirects=1&titles=' + encodeURIComponent(titles.slice(i, i + 20).join('|')))
    const back = Object.fromEntries((j.query.redirects ?? []).map(r => [r.to, r.from]))
    for (const p of j.query.pages) if (p.extract) out[back[p.title] ?? p.title] = p.extract.trim()
  }
  return out
}

const all = []
for (const c of CITIES) {
  const j = await json('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql(c)), { headers: { Accept: 'application/sparql-results+json' } })
  const rows = j.results.bindings.map(b => {
    const [lng, lat] = b.coord.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/).slice(1).map(Number)
    const file = decodeURIComponent(b.image.value.split('/').pop()).replace(/_/g, ' ')
    const title = b.article ? decodeURIComponent(b.article.value.split('/wiki/')[1]).replace(/_/g, ' ') : null
    // Tên: ưu tiên tên bài Wikipedia tiếng Việt, bỏ phần phân biệt kiểu 'X (Y)' hoặc 'X, Thành phố Y'
    const name = title?.replace(/ \(.*\)$|, .*$/, '') ?? b.name.value
    const type = typeOf(name, b.classes?.value ?? '')
    return { id: b.item.value.split('/').pop(), city: c.city, name, type, desc: b.desc?.value ?? '', lat, lng, file, title, rank: +b.sitelinks.value }
  })
  // order: thứ hạng nổi tiếng trong thành phố (0 = nổi tiếng nhất); bản đồ thu nhỏ chỉ hiện các địa danh đứng đầu
  all.push(...rows.slice(0, PER_CITY).map((r, order) => ({ ...r, order })))
  console.log(`${c.city}: ${rows.length} địa danh, lấy ${Math.min(rows.length, PER_CITY)}`)
  await sleep(1000)
}

const photo = await credits([...new Set(all.map(l => l.file))])
const text = await extracts(all.filter(l => l.title).map(l => l.title))
const landmarks = all.filter(l => photo[l.file]).map(({ file, title, ...l }) => ({
  ...l,
  extract: (title && text[title]) || '',
  wiki: title ? `https://vi.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` : `https://www.wikidata.org/wiki/${l.id}`,
  photo: photo[file],
}))
writeFileSync(new URL('../public/landmarks.json', import.meta.url), JSON.stringify(landmarks))
console.log(`Đã ghi ${landmarks.length} địa danh vào public/landmarks.json`)
for (const l of landmarks) console.log(`  ${String(l.rank).padStart(3)}  ${l.city.padEnd(16)} ${l.type.padEnd(9)} ${l.name}  ·  ${l.photo.author.slice(0, 30)} (${l.photo.license})`)
