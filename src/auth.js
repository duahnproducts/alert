// Đăng nhập (Google hoặc mã 6 số qua email), phát hiện trình duyệt trong app, trang Của tôi.
import { DEMO, sb, myProfile, updateName, myReviews, mySuggestions, deleteReview, deleteAccount } from './supabase.js'
import { h, isInAppBrowser, formatDate, formatPrice } from './util.js'
import { state, page, navigate, route, toast, mascot, errorBox, loadData } from './main.js'

const AFTER = 'qq:afterLogin'
let authReady = Promise.resolve()

export function initAuth() {
  authReady = (async () => {
    // getSession chờ client đổi ?code= trên URL lấy phiên (PKCE) sau khi Google chuyển về
    const { data, error } = await sb.auth.getSession()
    state.user = data.session?.user ?? null
    const params = new URLSearchParams(location.search)
    if (params.has('code') || params.has('error')) {
      if (error || params.has('error')) toast('Đăng nhập Google chưa xong. Thử lại, hoặc dùng mã qua email nhé')
      const next = sessionStorage.getItem(AFTER) || './'
      sessionStorage.removeItem(AFTER)
      navigate(next, { replace: true })
    }
    sb.auth.onAuthStateChange((_event, session) => {
      const changed = (session?.user?.id ?? null) !== (state.user?.id ?? null)
      state.user = session?.user ?? null
      if (changed) {
        document.querySelector('dialog.login[open]')?.close()
        setTimeout(route) // không gọi Supabase ngay trong callback này (supabase-js có thể bị kẹt khóa)
      }
    })
  })()
  return authReady
}

// Màn cần đăng nhập: chưa đăng nhập thì hiện lời mời và mở tấm đăng nhập; đăng nhập xong route() vẽ lại đúng màn này.
export async function requireLogin(what, render) {
  const path = location.pathname
  await authReady
  if (location.pathname !== path) return
  if (DEMO) {
    return page('Bản demo', h('div', { class: 'empty' },
      mascot('ngu', 96),
      h('h1', { tabindex: -1 }, `Bản demo chưa mở chức năng ${what}`),
      h('p', { class: 'muted' }, 'Quán và đánh giá đang hiện là dữ liệu minh họa. Khi app chạy thật, bạn đăng nhập rồi check-in tại quán để viết đánh giá.'),
      h('a', { href: './', class: 'btn' }, 'Về bản đồ')))
  }
  if (state.user) return render()
  page('Cần đăng nhập', h('div', { class: 'empty' },
    mascot('doi', 96),
    h('h1', { tabindex: -1 }, `Đăng nhập để ${what}`),
    h('p', { class: 'muted' }, 'Xem quán thì không cần đăng nhập. Chỉ khi viết đánh giá hoặc đề xuất quán mới cần.'),
    h('button', { type: 'button', class: 'btn', onclick: openLogin }, 'Đăng nhập')))
  openLogin()
}

export function openLogin() {
  if (DEMO) return toast('Bản demo chưa mở đăng nhập. Khi app chạy thật bạn sẽ đăng nhập ở đây nhé')
  if (document.querySelector('dialog.login[open]')) return
  const ua = navigator.userAgent
  const inApp = isInAppBrowser(ua)
  const android = /Android/i.test(ua)

  const email = h('input', { id: 'login-email', type: 'email', required: true, autocomplete: 'email', inputmode: 'email', placeholder: 'ban@gmail.com' })
  const code = h('input', { id: 'login-code', required: true, inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]{6,10}', maxlength: '10', placeholder: '123456' })
  const sendBtn = h('button', { class: 'btn btn-block' }, 'Gửi mã')
  const resendBtn = h('button', { type: 'button', class: 'link', onclick: () => send(true) }, 'Gửi lại mã')
  const sentTo = h('p')

  const emailForm = h('form', { class: 'stack' },
    h('label', { for: 'login-email' }, 'Email của bạn'), email, sendBtn)
  const codeForm = h('form', { class: 'stack', hidden: true },
    sentTo,
    h('label', { for: 'login-code' }, 'Mã trong email'), code,
    h('button', { class: 'btn btn-block' }, 'Xác nhận'),
    h('p', { class: 'row' }, resendBtn,
      h('button', { type: 'button', class: 'link', onclick: () => { codeForm.hidden = true; emailForm.hidden = false; email.focus() } }, 'Đổi email')))

  let cooldown
  async function send(again) {
    const addr = email.value.trim()
    if (!email.reportValidity()) return
    const btn = again ? resendBtn : sendBtn
    btn.disabled = true
    const { error } = await sb.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: true } })
    btn.disabled = false
    if (error) {
      return toast(error.status === 429
        ? 'Bạn gửi mã hơi nhiều. Đợi 1 phút rồi thử lại nhé'
        : 'Chưa gửi được mã. Kiểm tra lại email và mạng rồi thử lại nhé')
    }
    sentTo.replaceChildren('Mã đã gửi tới ', h('b', null, addr), '. Không thấy thì xem cả thư mục Spam hoặc Quảng cáo nhé.')
    emailForm.hidden = true
    codeForm.hidden = false
    code.focus()
    resendBtn.disabled = true
    clearTimeout(cooldown)
    cooldown = setTimeout(() => { resendBtn.disabled = false }, 60000)
  }
  emailForm.addEventListener('submit', e => { e.preventDefault(); send(false) })
  codeForm.addEventListener('submit', async e => {
    e.preventDefault()
    if (!code.reportValidity()) return
    const { error } = await sb.auth.verifyOtp({ email: email.value.trim(), token: code.value.trim(), type: 'email' })
    if (error) return toast('Mã chưa đúng hoặc đã hết hạn. Kiểm tra lại, hoặc bấm “Gửi lại mã” nhé')
    toast('Đăng nhập xong rồi!')
    // onAuthStateChange đóng tấm này và vẽ lại màn đang làm
  })

  async function google() {
    sessionStorage.setItem(AFTER, location.pathname + location.search)
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: document.baseURI } })
    if (error) toast('Chưa mở được đăng nhập Google. Thử lại, hoặc dùng mã qua email nhé')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href)
      toast('Đã chép link. Bấm ⋯ rồi chọn “Mở bằng trình duyệt”, hoặc dán vào Safari nhé')
    } catch {
      prompt('Chép link này rồi dán vào Safari nhé', location.href)
    }
  }

  const dlg = h('dialog', { class: 'sheet-dialog login', 'aria-labelledby': 'login-title', onclose: () => dlg.remove() },
    h('h2', { id: 'login-title' }, 'Đăng nhập'),
    h('p', { class: 'muted' }, 'Chỉ cần khi viết đánh giá hoặc đề xuất quán.'),
    inApp
      ? h('div', { class: 'note' },
          h('p', null, 'Bạn đang mở trong Facebook, Messenger hoặc Zalo. Google không cho đăng nhập ở đây, nên dùng mã qua email bên dưới nhé. Muốn dùng Google thì mở bằng trình duyệt thật.'),
          android
            ? h('a', { class: 'btn-ghost', href: `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end` }, 'Mở bằng Chrome')
            : h('button', { type: 'button', class: 'btn-ghost', onclick: copyLink }, 'Mở bằng Safari'))
      : [h('button', { type: 'button', class: 'btn btn-block google', onclick: google }, 'Tiếp tục với Google'),
         h('p', { class: 'divider' }, 'hoặc nhận mã qua email')],
    emailForm,
    codeForm,
    h('p', { class: 'small muted' }, 'Khi đăng nhập, bạn đồng ý với ',
      h('a', { href: 'gioi-thieu#rieng-tu', onclick: () => dlg.close() }, 'chính sách quyền riêng tư'), '.'),
    h('button', { type: 'button', class: 'link', onclick: () => dlg.close() }, 'Để sau'),
  )
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close() })
  document.body.append(dlg)
  dlg.showModal()
}

// ───────── Của tôi ─────────

const STATUS = { visible: 'Đang hiện', pending: 'Chờ duyệt', hidden: 'Đã ẩn' }

export async function renderMine() {
  const uid = state.user.id
  const name = h('input', { id: 'display-name', required: true, minlength: '2', maxlength: '30', autocomplete: 'nickname' })
  const reviewsBox = h('ul', { class: 'mine' }, h('li', { class: 'muted' }, 'Đang tải…'))
  const suggestBox = h('ul', { class: 'mine' })
  const nameForm = h('form', { class: 'row' }, name, h('button', { class: 'btn-ghost' }, 'Lưu'))
  nameForm.addEventListener('submit', async e => {
    e.preventDefault()
    if (!name.reportValidity()) return
    try {
      await updateName(uid, name.value.trim())
      toast('Đã đổi tên hiển thị')
    } catch {
      toast('Chưa đổi được tên. Tên cần 2–30 ký tự, thử lại nhé')
    }
  })

  page('Của tôi', [
    h('h1', { tabindex: -1 }, 'Của tôi'),
    h('section', { class: 'card' },
      h('label', { for: 'display-name' }, 'Tên hiển thị cạnh đánh giá'), nameForm,
      h('p', { class: 'small muted' }, `Đăng nhập bằng ${state.user.email ?? 'Google'}. Email không bao giờ hiện cho người khác.`)),
    h('section', null, h('h2', null, 'Đánh giá của bạn'), reviewsBox),
    h('section', null, h('h2', null, 'Quán bạn đề xuất'), suggestBox),
    h('section', { class: 'row wrap' },
      h('button', { type: 'button', class: 'btn-ghost', onclick: logout }, 'Đăng xuất'),
      h('button', { type: 'button', class: 'btn-danger', onclick: removeAccount }, 'Xóa tài khoản')),
  ])

  myProfile(uid).then(p => { name.value = p.display_name }, () => {})
  const loadReviews = () => myReviews(uid).then(rows => {
    reviewsBox.replaceChildren(...(rows.length ? rows.map(r => {
      const li = h('li', { class: 'card' },
        h('a', { href: `quan/${r.place_id}` }, h('b', null, r.places?.name ?? 'Quán đã ẩn')),
        h('p', null, `${'★'.repeat(r.stars)}${r.price_paid != null ? ` · ${formatPrice(r.price_paid)}` : ''} · ${formatDate(r.review_date)} · ${STATUS[r.status]}`),
        r.comment && h('p', { class: 'muted' }, r.comment),
        h('button', { type: 'button', class: 'link danger', onclick: async () => {
          if (!confirm('Xóa đánh giá này và ảnh của nó? Không khôi phục được.')) return
          try {
            await deleteReview(uid, r.id)
            li.remove()
            toast('Đã xóa đánh giá')
            loadData()
          } catch {
            toast('Chưa xóa được. Kiểm tra mạng rồi thử lại nhé')
          }
        } }, 'Xóa'))
      return li
    }) : [h('li', { class: 'muted' }, 'Bạn chưa viết đánh giá nào. Đến quán, check-in rồi viết nhé!')]))
  }, () => reviewsBox.replaceChildren(h('li', null, errorBox('Chưa tải được. Kiểm tra mạng rồi thử lại nhé.', loadReviews))))
  loadReviews()
  mySuggestions(uid).then(rows => {
    suggestBox.replaceChildren(...(rows.length
      ? rows.map(r => h('li', null, h('b', null, r.name), ` · ${r.status === 'pending' ? 'Chờ duyệt' : 'Chưa được duyệt'}`))
      : [h('li', { class: 'muted' }, 'Chưa có. ', h('a', { href: 'de-xuat' }, 'Đề xuất quán mới'))]))
  }, () => suggestBox.replaceChildren())

  async function logout() {
    await sb.auth.signOut()
    navigate('./')
  }

  async function removeAccount() {
    if (!confirm('Xóa tài khoản sẽ xóa vĩnh viễn mọi đánh giá, ảnh và email của bạn. Xóa nhé?')) return
    try {
      await deleteAccount(uid)
    } catch {
      return toast('Chưa xóa được tài khoản. Kiểm tra mạng rồi thử lại nhé')
    }
    await sb.auth.signOut({ scope: 'local' })
    navigate('./')
    toast('Đã xóa tài khoản và mọi dữ liệu của bạn')
    loadData()
  }
}
