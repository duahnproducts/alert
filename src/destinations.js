// Một luồng chỉ đường cho quán ăn và địa danh; link tương đối theo <base>.
export const directionsHref = (id, kind = 'quan') => `${kind}/${encodeURIComponent(id)}/chi-duong`

let landmarks
export function loadLandmarks() {
  if (!landmarks) {
    landmarks = fetch('landmarks.json').then(r => {
      if (!r.ok) throw new Error(`landmarks ${r.status}`)
      return r.json()
    }).catch(err => {
      landmarks = null // lỗi mạng không làm hỏng các lần thử lại
      throw err
    })
  }
  return landmarks
}
