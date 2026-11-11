
/* =========================================================
   CONFESSIONS THCS & THPT NGÃ SÁU
   Supabase configuration
   Chỉ sử dụng publishable/anon key ở trình duyệt.
   KHÔNG sử dụng service_role key.
   ========================================================= */

const SUPABASE_URL = "https://oihiudvxxdrvdzzhpxhg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_pXNd1aqzBLOyVp_87c9qJg_t_FfdzFT";

const configured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("PASTE_") &&
  !SUPABASE_ANON_KEY.includes("PASTE_");

const supabaseClient = configured && window.supabase
  ? window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    )
  : null;


/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

const $ = (selector, parent = document) =>
  parent.querySelector(selector);

const $$ = (selector, parent = document) =>
  [...parent.querySelectorAll(selector)];

const page = document.body.dataset.page;

const REACTIONS = [
  { type: "like", label: "Thích", emoji: "👍" },
  { type: "love", label: "Yêu thích", emoji: "❤️" },
  { type: "haha", label: "Haha", emoji: "😆" },
  { type: "sad", label: "Buồn", emoji: "😢" },
  { type: "angry", label: "Phẫn nộ", emoji: "😡" }
];

let currentUser = null;
let currentProfile = null;
let feedCache = [];


/* =========================================================
   COMMON FUNCTIONS
   ========================================================= */

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}


function toast(message) {
  const el = $("#toast");

  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    el.classList.remove("show");
  }, 3200);
}


function showMessage(el, message, kind = "info") {
  if (!el) return;

  el.textContent = message;

  el.className = "rounded-xl p-3 text-sm " +
    (
      kind === "error"
        ? "bg-rose-50 text-rose-700"
        : kind === "success"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-sky-50 text-sky-700"
    );
}


function requireConfig() {
  if (!supabaseClient) {
    toast(
      "Bạn cần kiểm tra SUPABASE_URL, SUPABASE_ANON_KEY và thư viện Supabase trong HTML."
    );

    return false;
  }

  return true;
}


/* =========================================================
   AUTH SESSION
   ========================================================= */

async function getSessionUser() {
  if (!requireConfig()) return null;

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) console.error(error);

  currentUser = data?.session?.user || null;

  if (currentUser) {
    const { data: profile, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("id", currentUser.id)
        .maybeSingle();

    if (profileError) {
      console.warn(
        "Không tải được profile:",
        profileError.message
      );
    }

    currentProfile = profile || null;

  } else {
    currentProfile = null;
  }

  return currentUser;
}


function updateHeader() {
  const authNav = $("#authNav");
  const logoutBtn = $("#logoutBtn");
  const adminNav = $("#adminNav");

  if (authNav) {
    authNav.classList.toggle("hidden", !!currentUser);
  }

  if (logoutBtn) {
    logoutBtn.classList.toggle("hidden", !currentUser);
  }

  if (adminNav) {
    adminNav.classList.toggle(
      "hidden",
      currentProfile?.role !== "admin"
    );
  }
}


async function signOutAndGo() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  location.href = "./index.html";
}


/* =========================================================
   DATE FUNCTIONS
   ========================================================= */

function formatDate(dateString) {
  const d = new Date(
    dateString +
    (String(dateString).length === 10 ? "T00:00:00" : "")
  );

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(d);
}


function formatDateTime(dateString) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(dateString));
}


function groupByDate(items) {
  return items.reduce((groups, item) => {
    (groups[item.publish_date] ||= []).push(item);
    return groups;
  }, {});
}


/* =========================================================
   LOAD CONFESSION FEED
   ========================================================= */

async function loadFeed() {
  const host = $("#feedList");

  if (!host || !requireConfig()) return;

  host.innerHTML = `
    <div class="skeleton h-28 rounded-2xl"></div>
    <div class="skeleton h-28 rounded-2xl"></div>
  `;

  const { data, error } = await supabaseClient
    .from("confessions")
    .select("id, content, cfs_number, publish_date, created_at")
    .eq("status", "approved")
    .not("cfs_number", "is", null)
    .order("publish_date", { ascending: false })
    .order("cfs_number", { ascending: true })
    .limit(100);

  if (error) {
    host.innerHTML = `
      <p class="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
        ${escapeHTML(error.message)}
      </p>
    `;

    return;
  }

  feedCache = data || [];

  if (!feedCache.length) {
    host.innerHTML = `
      <div class="rounded-2xl bg-slate-50 p-8 text-center">
        <div class="text-3xl">💌</div>
        <p class="mt-3 font-bold">
          Chưa có confession nào được đăng.
        </p>
        <p class="mt-1 text-sm text-slate-500">
          Hãy là người gửi lời nhắn đầu tiên nhé!
        </p>
      </div>
    `;

    return;
  }

  const groups = groupByDate(feedCache);
  const interactionPostId = feedCache[feedCache.length - 1].id;

  host.innerHTML = `
    <article class="rounded-3xl border border-slate-100 bg-white p-4 shadow-soft sm:p-6">
      <div class="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 class="text-lg font-black text-slate-800">Bảng tin Confessions</h3>
          <p class="mt-1 text-xs text-slate-500">${feedCache.length} lời nhắn được đăng</p>
        </div>
        <span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">💌 Bản tin</span>
      </div>

      <div class="space-y-5">
        ${Object.entries(groups).map(([date, posts]) => `
          <section>
            <div class="mb-3 flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-brand-500"></span>
              <h4 class="text-sm font-extrabold text-slate-700">Bài đăng ngày ${formatDate(date)}</h4>
              <span class="h-px flex-1 bg-slate-100"></span>
            </div>
            <div class="space-y-4">
              ${posts.map(post => renderPost(post)).join("")}
            </div>
          </section>
        `).join("")}
      </div>

      <div class="mt-6 border-t-2 border-brand-100 pt-4">
        <p class="mb-3 text-sm font-extrabold text-slate-800">Cảm xúc & bình luận cho toàn bộ bản tin</p>
        <div id="reactions-${interactionPostId}" class="flex flex-wrap gap-2">
          <span class="text-xs text-slate-400">Đang tải cảm xúc...</span>
        </div>
        <div class="mt-3 flex items-center justify-between">
          <span id="commentCount-${interactionPostId}" class="text-xs text-slate-400">Bình luận</span>
          <button data-comments-toggle="${interactionPostId}" class="text-xs font-bold text-brand-700 hover:underline">Xem / viết bình luận</button>
        </div>
        <div id="comments-${interactionPostId}" class="mt-3 hidden border-t border-slate-100 pt-3">
          <div id="commentList-${interactionPostId}" class="space-y-3"></div>
          <form data-comment-form="${interactionPostId}" class="mt-3 flex gap-2">
            <input name="content" required maxlength="1500"
              placeholder="${currentUser ? "Viết bình luận cho bản tin..." : "Đăng nhập để bình luận"}"
              ${currentUser ? "" : "disabled"}
              class="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 disabled:opacity-60">
            <button ${currentUser ? "" : "disabled"} class="rounded-xl bg-brand-600 px-4 text-sm font-bold text-white disabled:opacity-40">Gửi</button>
          </form>
          ${currentUser ? "" : `<p class="mt-2 text-xs text-slate-400">Bạn cần <a class="font-bold text-brand-700" href="./auth.html">đăng nhập</a> để bình luận.</p>`}
        </div>
      </div>
    </article>
  `;


  // Tương tác chung của toàn bộ bản tin được lưu tại CFS cũ nhất
  // để ID đích ổn định khi có thêm CFS mới.
  await loadPostInteractions(interactionPostId);
}


/* =========================================================
   RENDER POST
   ĐÃ BỔ SUNG NÚT XÓA CHO ADMIN
   ========================================================= */

function renderPost(post) {
  const isAdmin = currentProfile?.role === "admin";
  return `
    <div class="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
      <div class="flex items-center justify-between gap-3">
        <span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700">#cfs${post.cfs_number}</span>
        <span class="text-[11px] text-slate-400">${formatDateTime(post.created_at)}</span>
      </div>
      <p class="post-content mt-3 text-sm leading-7 text-slate-700">${escapeHTML(post.content)}</p>
      ${isAdmin ? `
        <div class="mt-3 flex justify-end">
          <button type="button" data-delete-feed="${post.id}" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100">🗑️ Xóa bài viết</button>
        </div>
      ` : ""}
    </div>
  `;
}


/* =========================================================
   LOAD REACTIONS AND COMMENTS
   ========================================================= */

async function loadPostInteractions(confessionId) {

  const [reactionResult, commentResult] = await Promise.all([

    supabaseClient
      .from("reactions")
      .select("type,user_id")
      .eq("confession_id", confessionId),

    supabaseClient
      .from("comments_with_author")
      .select("id,parent_id,user_id,content,created_at,full_name,email")
      .eq("confession_id", confessionId)
      .order("created_at", { ascending: true })

  ]);

  if (reactionResult.error) {
    console.warn(reactionResult.error);
  }

  if (commentResult.error) {
    console.warn(commentResult.error);
  }

  renderReactions(
    confessionId,
    reactionResult.data || []
  );

  renderComments(
    confessionId,
    commentResult.data || []
  );
}


/* =========================================================
   RENDER REACTIONS
   ========================================================= */

function renderReactions(id, rows) {

  const host = $(`#reactions-${id}`);

  if (!host) return;

  host.innerHTML = REACTIONS.map(r => {

    const count = rows.filter(
      x => x.type === r.type
    ).length;

    const mine = rows.some(
      x =>
        x.type === r.type &&
        x.user_id === currentUser?.id
    );

    return `
      <button
        class="reaction-btn ${mine ? "active" : ""}"
        data-reaction="${r.type}"
        data-post="${id}"
        title="${r.label}"
      >
        ${r.emoji}
        ${r.label}
        <span>${count}</span>
      </button>
    `;

  }).join("");
}


/* =========================================================
   RENDER COMMENTS
   ========================================================= */

function renderComments(id, rows) {

  const host = $(`#commentList-${id}`);
  const count = $(`#commentCount-${id}`);

  if (!host) return;

  count.textContent = `${rows.length} bình luận`;

  const roots = rows.filter(c => !c.parent_id);
  const children = rows.filter(c => c.parent_id);

  const renderOne = (c, nested = false) => `

    <div class="${
      nested
        ? "ml-6 border-l-2 border-brand-100 pl-3"
        : ""
    }">

      <div class="rounded-xl bg-slate-50 p-3">

        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">

          <strong class="text-xs font-extrabold">
            ${escapeHTML(c.full_name || "Người dùng")}
          </strong>

          <span class="text-[11px] text-slate-400">
            ${escapeHTML(c.email || "")}
          </span>

          <time class="ml-auto text-[10px] text-slate-400">
            ${formatDateTime(c.created_at)}
          </time>

        </div>

        <p class="comment-content mt-2 text-sm text-slate-700">
          ${escapeHTML(c.content)}
        </p>

        ${
          currentUser
            ? `
              <button
                data-reply="${c.id}"
                data-post="${id}"
                class="mt-2 text-xs font-bold text-brand-700 hover:underline"
              >
                ↳ Trả lời
              </button>
            `
            : ""
        }

      </div>

      <div id="replyForm-${c.id}"></div>

    </div>

  `;

  host.innerHTML = roots.length

    ? roots.map(root => `
        ${renderOne(root)}

        ${children
          .filter(c => c.parent_id === root.id)
          .map(child => renderOne(child, true))
          .join("")}
      `).join("")

    : `
      <p class="py-3 text-center text-xs text-slate-400">
        Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện!
      </p>
    `;
}


/* =========================================================
   SUBMIT COMMENT
   ========================================================= */

async function submitComment(
  confessionId,
  content,
  parentId = null
) {

  if (!currentUser) {
    return toast("Vui lòng đăng nhập để bình luận.");
  }

  const { error } = await supabaseClient
    .from("comments")
    .insert({
      confession_id: confessionId,
      parent_id: parentId,
      user_id: currentUser.id,
      content: content.trim()
    });

  if (error) throw error;

  await loadPostInteractions(confessionId);
}


/* =========================================================
   TOGGLE REACTION
   ========================================================= */

async function toggleReaction(confessionId, type) {

  if (!currentUser) {
    return toast("Vui lòng đăng nhập để thả cảm xúc.");
  }

  const { data: existing, error: findError } =
    await supabaseClient
      .from("reactions")
      .select("id,type")
      .eq("confession_id", confessionId)
      .eq("user_id", currentUser.id)
      .maybeSingle();

  if (findError) throw findError;


  if (existing?.type === type) {

    const { error } = await supabaseClient
      .from("reactions")
      .delete()
      .eq("id", existing.id);

    if (error) throw error;

  } else if (existing) {

    const { error } = await supabaseClient
      .from("reactions")
      .update({ type })
      .eq("id", existing.id);

    if (error) throw error;

  } else {

    const { error } = await supabaseClient
      .from("reactions")
      .insert({
        confession_id: confessionId,
        user_id: currentUser.id,
        type
      });

    if (error) throw error;
  }

  await loadPostInteractions(confessionId);
}


/* =========================================================
   DELETE CONFESSION FROM HOMEPAGE
   ADMIN ONLY
   ========================================================= */

async function deleteFeedConfession(id, button) {

  if (currentProfile?.role !== "admin") {
    toast("Bạn không có quyền xóa bài viết.");
    return;
  }

  const confirmed = confirm(
    "Bạn chắc chắn muốn xóa CFS này?\n\nThao tác này không thể hoàn tác."
  );

  if (!confirmed) return;

  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = "Đang xóa...";

  try {

    const { error } = await supabaseClient
      .from("confessions")
      .delete()
      .eq("id", id);

    if (error) throw error;

    toast("Đã xóa CFS thành công.");

    await loadFeed();

  } catch (error) {

    console.error("Lỗi xóa confession:", error);

    toast("Không thể xóa CFS: " + error.message);

    button.disabled = false;
    button.textContent = originalText;
  }
}


/* =========================================================
   FEED CLICK EVENTS
   ========================================================= */

async function handleFeedClick(event) {

  // ADMIN XÓA CFS NGAY TRÊN TRANG CHỦ

  const deleteBtn = event.target.closest("[data-delete-feed]");

  if (deleteBtn) {

    const id = deleteBtn.dataset.deleteFeed;

    await deleteFeedConfession(id, deleteBtn);

    return;
  }


  // THẢ CẢM XÚC

  const reaction = event.target.closest("[data-reaction]");

  if (reaction) {

    try {

      await toggleReaction(
        reaction.dataset.post,
        reaction.dataset.reaction
      );

    } catch (e) {

      toast(e.message || "Không thể cập nhật cảm xúc.");
    }

    return;
  }


  // ẨN / HIỆN BÌNH LUẬN

  const toggle = event.target.closest("[data-comments-toggle]");

  if (toggle) {

    const area = $(
      `#comments-${toggle.dataset.commentsToggle}`
    );

    if (!area) return;

    area.classList.toggle("hidden");

    if (!area.classList.contains("hidden")) {

      area.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }

    return;
  }


  // TRẢ LỜI BÌNH LUẬN

  const reply = event.target.closest("[data-reply]");

  if (reply) {

    const target = $(`#replyForm-${reply.dataset.reply}`);

    if (!target) return;

    target.innerHTML = `

      <form
        class="reply-form flex gap-2"
        data-reply-form="${reply.dataset.reply}"
        data-post="${reply.dataset.post}"
      >

        <input
          name="content"
          required
          maxlength="1500"
          placeholder="Viết câu trả lời..."
          class="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >

        <button
          class="rounded-xl bg-brand-600 px-3 text-xs font-bold text-white"
        >
          Gửi
        </button>

        <button
          type="button"
          data-cancel-reply
          class="rounded-xl bg-slate-100 px-3 text-xs font-bold"
        >
          Hủy
        </button>

      </form>
    `;

    return;
  }


  // HỦY TRẢ LỜI

  const cancel = event.target.closest("[data-cancel-reply]");

  if (cancel) {
    cancel.closest("form").remove();
  }
}


/* =========================================================
   FEED SUBMIT EVENTS
   ========================================================= */

async function handleFeedSubmit(event) {

  // GỬI BÌNH LUẬN

  const commentForm = event.target.closest(
    "form[data-comment-form]"
  );

  if (commentForm) {

    event.preventDefault();

    try {

      const content = new FormData(commentForm).get("content");

      await submitComment(
        commentForm.dataset.commentForm,
        content
      );

      commentForm.reset();

      toast("Đã gửi bình luận.");

    } catch (e) {

      toast(e.message || "Không thể gửi bình luận.");
    }

    return;
  }


  // GỬI CÂU TRẢ LỜI

  const replyForm = event.target.closest(
    "form[data-reply-form]"
  );

  if (replyForm) {

    event.preventDefault();

    try {

      const content = new FormData(replyForm).get("content");

      await submitComment(
        replyForm.dataset.post,
        content,
        replyForm.dataset.replyForm
      );

      toast("Đã gửi câu trả lời.");

    } catch (e) {

      toast(e.message || "Không thể gửi câu trả lời.");
    }
  }
}


/* =========================================================
   INITIALIZE HOMEPAGE
   ========================================================= */

async function initFeed() {

  await getSessionUser();

  updateHeader();


  if ($("#sendHint")) {

    $("#sendHint").textContent = currentUser

      ? `Đang gửi với tài khoản: ${
          currentProfile?.full_name || currentUser.email
        } · Bài viết chờ quản trị viên duyệt.`

      : "Bạn cần đăng nhập để gửi confession.";
  }


  // GỬI CONFESSION

  $("#confessionForm")?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      if (!currentUser) {
        location.href = "./auth.html";
        return;
      }

      const content = $("#confessionContent").value.trim();

      if (content.length < 3) {
        return toast(
          "Nội dung cần có ít nhất 3 ký tự."
        );
      }

      const button = event.submitter;

      if (button) button.disabled = true;

      try {

        const { error } = await supabaseClient.rpc(
          "submit_confession",
          {
            p_content: content
          }
        );

        if (error) throw error;

        $("#confessionForm").reset();

        showMessage(
          $("#sendMessage"),
          "Đã gửi confession! Bài viết đang chờ quản trị viên duyệt.",
          "success"
        );

        toast("Gửi confession thành công.");

      } catch (e) {

        showMessage(
          $("#sendMessage"),
          e.message || "Gửi thất bại.",
          "error"
        );

      } finally {

        if (button) button.disabled = false;
      }
    }
  );


  // TẢI LẠI FEED

  $("#refreshFeed")?.addEventListener(
    "click",
    loadFeed
  );


  // ĐĂNG XUẤT

  $("#logoutBtn")?.addEventListener(
    "click",
    signOutAndGo
  );


  // SỰ KIỆN CLICK TRÊN FEED

  $("#feedList")?.addEventListener(
    "click",
    handleFeedClick
  );


  // SỰ KIỆN GỬI BÌNH LUẬN

  $("#feedList")?.addEventListener(
    "submit",
    handleFeedSubmit
  );


  // THEO DÕI THAY ĐỔI ĐĂNG NHẬP

  if (supabaseClient) {

    supabaseClient.auth.onAuthStateChange(
      async () => {

        await getSessionUser();

        updateHeader();

        if ($("#sendHint")) {

          $("#sendHint").textContent = currentUser

            ? `Đang gửi với tài khoản: ${
                currentProfile?.full_name || currentUser.email
              } · Bài viết chờ duyệt.`

            : "Bạn cần đăng nhập để gửi confession.";
        }

        await loadFeed();
      }
    );
  }


  await loadFeed();
}


/* =========================================================
   AUTHENTICATION
   ========================================================= */

let authMode = "login";


function setAuthMode(mode) {

  authMode = mode;

  const signup = mode === "signup";

  $("#nameField")?.classList.toggle(
    "hidden",
    !signup
  );


  if ($("#loginTab")) {

    $("#loginTab").className = signup

      ? "flex-1 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500"

      : "flex-1 rounded-xl bg-white px-3 py-2.5 text-sm font-extrabold text-brand-700 shadow-sm";
  }


  if ($("#signupTab")) {

    $("#signupTab").className = signup

      ? "flex-1 rounded-xl bg-white px-3 py-2.5 text-sm font-extrabold text-brand-700 shadow-sm"

      : "flex-1 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500";
  }


  $("#authTitle").textContent = signup
    ? "Tạo tài khoản mới"
    : "Chào mừng trở lại!";


  $("#authSubtitle").textContent = signup

    ? "Điền thông tin để tham gia cộng đồng."

    : "Đăng nhập bằng email và mật khẩu của bạn.";


  $("#authSubmit").textContent = signup
    ? "Tạo tài khoản"
    : "Đăng nhập";


  $("#password").autocomplete = signup
    ? "new-password"
    : "current-password";
}


async function initAuth() {

  if (!requireConfig()) return;


  $("#loginTab").addEventListener(
    "click",
    () => setAuthMode("login")
  );


  $("#signupTab").addEventListener(
    "click",
    () => setAuthMode("signup")
  );


  $("#authForm").addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const message = $("#authMessage");

      const email = $("#email").value
        .trim()
        .toLowerCase();

      const password = $("#password").value;

      const button = $("#authSubmit");

      button.disabled = true;

      try {

        if (authMode === "signup") {

          const fullName = $("#fullName").value.trim();

          if (fullName.length < 2) {
            throw new Error(
              "Vui lòng nhập họ tên hợp lệ."
            );
          }

          const { data, error } =
            await supabaseClient.auth.signUp({

              email,

              password,

              options: {
                data: {
                  full_name: fullName
                }
              }

            });

          if (error) throw error;

          if (data.session) {

            location.href = "./index.html";

          } else {

            showMessage(
              message,
              "Đăng ký thành công. Hãy kiểm tra email để xác nhận tài khoản, sau đó đăng nhập.",
              "success"
            );
          }

        } else {

          const { error } =
            await supabaseClient.auth.signInWithPassword({
              email,
              password
            });

          if (error) throw error;

          location.href = "./index.html";
        }

      } catch (e) {

        showMessage(
          message,
          e.message || "Có lỗi xảy ra.",
          "error"
        );

      } finally {

        button.disabled = false;
      }
    }
  );
}


/* =========================================================
   ADMIN APPROVAL
   ========================================================= */

let pendingItems = [];

const selectedIds = new Set();


function updateSelectionUI() {

  const count = selectedIds.size;

  $("#selectedLabel").textContent =
    `Đã chọn ${count} bài`;

  $("#approveSelected").textContent =
    `Duyệt (${count}) bài đã chọn`;

  $("#approveSelected").disabled =
    count === 0;

  $("#selectAll").checked =
    pendingItems.length > 0 &&
    count === pendingItems.length;

  $("#selectAll").indeterminate =
    count > 0 &&
    count < pendingItems.length;
}


/* =========================================================
   RENDER PENDING POSTS
   ========================================================= */

function renderPending() {

  const host = $("#pendingList");

  $("#pendingCount").textContent =
    `${pendingItems.length} bài chờ duyệt`;


  if (!pendingItems.length) {

    host.innerHTML = `

      <div class="rounded-3xl border border-slate-100 bg-white p-12 text-center shadow-sm">

        <div class="text-4xl">🎉</div>

        <h3 class="mt-3 font-black">
          Không còn bài chờ duyệt
        </h3>

        <p class="mt-1 text-sm text-slate-500">
          Bạn đã xử lý hết danh sách hiện tại.
        </p>

      </div>

    `;

    updateSelectionUI();

    return;
  }


  host.innerHTML = pendingItems.map(item => `

    <article class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">

      <div class="flex items-start gap-3">

        <input
          type="checkbox"
          data-select-id="${item.id}"
          ${selectedIds.has(item.id) ? "checked" : ""}
          class="mt-1 h-4 w-4 accent-brand-600"
        >

        <div class="min-w-0 flex-1">

          <div class="flex flex-wrap items-center gap-2">

            <span class="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-extrabold text-amber-700">
              CHỜ DUYỆT
            </span>

            <time class="text-xs text-slate-400">
              ${formatDateTime(item.created_at)}
            </time>

          </div>


          <p class="post-content mt-4 text-sm leading-7 text-slate-700">
            ${escapeHTML(item.content)}
          </p>


          <div class="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">

            <strong class="text-slate-800">
              Người gửi:
            </strong>

            ${escapeHTML(item.sender_name || "Chưa có tên")}

            <br>

            <strong class="text-slate-800">
              Email:
            </strong>

            ${escapeHTML(item.sender_email || "Không có email")}

          </div>


          <div class="mt-3 flex justify-end">

            <button
              data-delete-id="${item.id}"
              class="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
            >
              Xóa bài viết
            </button>

          </div>

        </div>

      </div>

    </article>

  `).join("");


  updateSelectionUI();
}


/* =========================================================
   LOAD PENDING POSTS
   ========================================================= */

async function loadPending() {

  if (!requireConfig()) return;

  $("#pendingList").innerHTML =
    '<div class="skeleton h-36 rounded-2xl"></div>';


  const { data, error } =
    await supabaseClient.rpc(
      "admin_pending_confessions"
    );


  if (error) {

    $("#pendingList").innerHTML = `

      <div class="rounded-2xl bg-rose-50 p-5 text-sm text-rose-700">

        Không tải được danh sách:
        ${escapeHTML(error.message)}

        <br>

        <span class="text-xs">
          Kiểm tra tài khoản đã được cấp role admin trong bảng profiles chưa.
        </span>

      </div>

    `;

    return;
  }


  pendingItems = data || [];

  const ids = new Set(
    pendingItems.map(x => x.id)
  );


  [...selectedIds].forEach(id => {

    if (!ids.has(id)) {
      selectedIds.delete(id);
    }

  });


  renderPending();
}


/* =========================================================
   INITIALIZE ADMIN PAGE
   ========================================================= */

async function initAdmin() {

  if (!await getSessionUser()) {

    location.href = "./auth.html";

    return;
  }


  if (currentProfile?.role !== "admin") {

    document.body.innerHTML = `

      <main class="mx-auto max-w-xl px-5 py-24 text-center">

        <div class="text-5xl">🔒</div>

        <h1 class="mt-4 text-2xl font-black">
          Bạn không có quyền truy cập
        </h1>

        <p class="mt-2 text-slate-500">
          Trang này chỉ dành cho quản trị viên.
        </p>

        <a
          class="mt-6 inline-block rounded-xl bg-brand-600 px-5 py-3 font-bold text-white"
          href="./index.html"
        >
          Về trang chủ
        </a>

      </main>

    `;

    return;
  }


  // ĐĂNG XUẤT ADMIN

  $("#adminLogout").addEventListener(
    "click",
    signOutAndGo
  );


  // TẢI LẠI DANH SÁCH

  $("#reloadPending").addEventListener(
    "click",
    loadPending
  );


  // CHỌN BÀI VIẾT

  $("#pendingList").addEventListener(
    "change",
    event => {

      const cb = event.target.closest(
        "[data-select-id]"
      );

      if (!cb) return;

      if (cb.checked) {

        selectedIds.add(cb.dataset.selectId);

      } else {

        selectedIds.delete(cb.dataset.selectId);
      }

      updateSelectionUI();
    }
  );


  // CHỌN TẤT CẢ

  $("#selectAll").addEventListener(
    "change",
    event => {

      selectedIds.clear();

      if (event.target.checked) {

        pendingItems.forEach(item => {
          selectedIds.add(item.id);
        });
      }

      renderPending();
    }
  );


  // XÓA BÀI CHỜ DUYỆT

  $("#pendingList").addEventListener(
    "click",
    async event => {

      const btn = event.target.closest(
        "[data-delete-id]"
      );

      if (!btn) return;

      if (!confirm(
        "Bạn chắc chắn muốn xóa confession này? Thao tác không thể hoàn tác."
      )) {
        return;
      }

      btn.disabled = true;

      const originalText = btn.textContent;

      btn.textContent = "Đang xóa...";


      try {

        const { error } = await supabaseClient
          .from("confessions")
          .delete()
          .eq("id", btn.dataset.deleteId);

        if (error) throw error;

        selectedIds.delete(btn.dataset.deleteId);

        toast("Đã xóa bài viết.");

        await loadPending();

      } catch (error) {

        toast("Không thể xóa: " + error.message);

        btn.disabled = false;

        btn.textContent = originalText;
      }
    }
  );


  // DUYỆT CÁC BÀI ĐÃ CHỌN

  $("#approveSelected").addEventListener(
    "click",
    async () => {

      const ids = [...selectedIds];

      if (!ids.length) return;

      if (!confirm(
        `Duyệt ${ids.length} bài đã chọn? Số thứ tự sẽ được cấp theo ngày đăng.`
      )) {
        return;
      }

      const btn = $("#approveSelected");

      btn.disabled = true;


      try {

        const { data, error } =
          await supabaseClient.rpc(
            "admin_approve_confessions",
            {
              p_ids: ids
            }
          );

        if (error) throw error;

        toast(
          `Đã duyệt ${data ?? ids.length} bài viết.`
        );

        selectedIds.clear();

        await loadPending();

      } catch (error) {

        toast(
          "Không thể duyệt bài: " + error.message
        );

      } finally {

        updateSelectionUI();
      }
    }
  );


  await loadPending();
}


/* =========================================================
   SERVICE WORKER
   ========================================================= */

function registerServiceWorker() {

  if (
    "serviceWorker" in navigator &&
    (
      location.protocol === "https:" ||
      location.hostname === "localhost"
    )
  ) {

    window.addEventListener(
      "load",
      () => {

        navigator.serviceWorker
          .register("./sw.js")
          .catch(err => {
            console.warn("SW:", err);
          });

      }
    );
  }
}


/* =========================================================
   APPLICATION START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    registerServiceWorker();

    if (page === "feed") {
      initFeed();
    }

    if (page === "auth") {
      initAuth();
    }

    if (page === "admin") {
      initAdmin();
    }

  }
);
