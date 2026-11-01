// HugoSMP Dashboard – Logik
const MAX_FILES = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

const state = {
  token: localStorage.getItem('hugoDmDashboardToken') || '',
  currentView: localStorage.getItem('hugoDashboardCurrentView') || 'overview',
  threads: [],
  selectedUserId: null,
  selectedThread: null,
  filter: 'active',
  search: '',
  stock: [],
  tickets: [],
  selectedTicketId: null,
  selectedTicket: null,
  ticketState: 'open',
  ticketType: 'all',
  orders: [],
  selectedOrderId: null,
  selectedOrder: null,
  selectedInvoice: null,
  orderStatus: 'active',
  staff: [],
  shopStock: [],
  shopChannels: [],
  pending: {}
};

const $ = id => document.getElementById(id);

function showToast(message, isError = false) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

function isEditingElement(element = document.activeElement) {
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
}

function shouldPauseAutoRefresh() {
  return isEditingElement() || Object.keys(state.pending).length > 0;
}

async function withPending(key, action) {
  if (state.pending[key]) return;
  state.pending[key] = true;
  try {
    return await action();
  } finally {
    delete state.pending[key];
  }
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (!options.noAuth && state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(path, {
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string'
      ? JSON.stringify(options.body)
      : options.body
  });

  const data = await response.json().catch(() => ({ success: false, error: 'Server-Antwort war ungültig.' }));
  if (!response.ok || data.success === false) {
    const error = new Error(data.error || 'Anfrage fehlgeschlagen.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function formatTime(value, withDate = false) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: withDate ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  if (value > 0 && value < 60) return '<1m';
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function preview(thread) {
  const last = thread.lastMessage;
  if (!last) return 'Noch keine Nachrichten';
  if (last.content) return last.content;
  if (last.attachments?.length) return `${last.attachments.length} Anhang`;
  return 'Nachricht';
}

function avatarNode(source) {
  if (source?.avatarUrl) {
    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = source.avatarUrl;
    img.alt = '';
    return img;
  }

  const div = document.createElement('div');
  div.className = 'avatar';
  div.textContent = (source?.username || source?.tag || source?.userId || '?').slice(0, 1).toUpperCase();
  return div;
}

function discordEmojiHtml(emoji) {
  const value = String(emoji || '').trim();
  const match = value.match(/^<(a?):([^:]+):(\d{15,20})>$/);
  if (!match) return escapeHtml(value);

  const animated = match[1] === 'a';
  const name = match[2];
  const id = match[3];
  const ext = animated ? 'gif' : 'png';

  return `<img class="emoji-icon" src="https://cdn.discordapp.com/emojis/${id}.${ext}?size=32&quality=lossless" alt="${escapeHtml(name)}">`;
}

function stockNameHtml(item) {
  return `${discordEmojiHtml(item.emoji)}${escapeHtml(item.name)}`;
}

function stockIdFromName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 30);
}

function syncStockIdSuggestion() {
  const idInput = $('stockNewId');
  if (idInput.dataset.touched === 'true') return;
  idInput.value = stockIdFromName($('stockNewName').value);
}

function resetStockCreateForm() {
  $('stockCreateForm').reset();
  $('stockNewAmount').value = '0';
  $('stockNewId').dataset.touched = 'false';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function restoreMarkdownPlaceholders(html, placeholders) {
  return html.replace(/\uE000(\d+)\uE001/g, (_, index) => placeholders[Number(index)] || '');
}

function renderDiscordInline(line, stash) {
  let html = line.replace(/`([^`\n]+)`/g, (_, code) => (
    stash(`<code class="md-inline-code">${code}</code>`)
  ));

  html = html
    .replace(/\|\|(.+?)\|\|/g, '<span class="md-spoiler">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');

  return html;
}

function renderMarkdownLine(line, stash) {
  if (/^\uE000\d+\uE001$/.test(line)) return line;

  const heading = line.match(/^(#{1,3})\s+(.+)$/);
  if (heading) {
    const level = heading[1].length;
    return `<h${level}>${renderDiscordInline(heading[2], stash)}</h${level}>`;
  }

  const quote = line.match(/^&gt;\s?(.*)$/);
  if (quote) return `<blockquote>${renderDiscordInline(quote[1], stash)}</blockquote>`;

  const list = line.match(/^[-*]\s+(.+)$/);
  if (list) return `<div class="md-list">• ${renderDiscordInline(list[1], stash)}</div>`;

  return renderDiscordInline(line, stash);
}

function renderDiscordMarkdown(content) {
  const placeholders = [];
  const stash = html => {
    const token = `\uE000${placeholders.length}\uE001`;
    placeholders.push(html);
    return token;
  };

  let source = escapeHtml(content).replace(/\r\n/g, '\n');
  source = source.replace(/```(?:[a-z0-9_-]+)?\n?([\s\S]*?)```/gi, (_, code) => (
    stash(`<pre><code>${code.replace(/^\n|\n$/g, '')}</code></pre>`)
  ));

  const html = source
    .split('\n')
    .map(line => renderMarkdownLine(line, stash))
    .join('<br>');

  return restoreMarkdownPlaceholders(html, placeholders);
}

function rowText(title, sub, right) {
  const row = document.createElement('div');
  row.className = 'data-row';
  const main = document.createElement('div');
  main.className = 'data-main';
  const text = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'data-title';
  name.textContent = title;
  const meta = document.createElement('div');
  meta.className = 'data-sub';
  meta.textContent = sub || '';
  text.append(name, meta);
  main.appendChild(text);
  const side = document.createElement('div');
  side.innerHTML = right || '';
  row.append(main, side);
  return row;
}

function rowHtml(titleHtml, sub, right) {
  const row = rowText('', sub, right);
  row.querySelector('.data-title').innerHTML = titleHtml;
  return row;
}

function renderMetric(label, value, sub) {
  const metric = document.createElement('section');
  metric.className = 'metric';
  const l = document.createElement('span');
  l.textContent = label;
  const v = document.createElement('strong');
  v.textContent = value;
  const s = document.createElement('small');
  s.textContent = sub || '';
  metric.append(l, v, s);
  return metric;
}

function ticketTypeLabel(type) {
  return ({
    support: 'Support',
    bestellung: 'Bestellung',
    reward: 'Reward'
  })[type] || type || 'Ticket';
}

function ticketStatePill(state) {
  return state === 'closed'
    ? '<span class="pill bad">geschlossen</span>'
    : '<span class="pill good">offen</span>';
}

function orderStatusPill(status) {
  const map = {
    offen: ['Offen', 'warn'],
    bearbeitung: ['In Bearbeitung', 'warn'],
    bezahlt: ['Bezahlt', 'good'],
    fertig: ['Fertig', 'good'],
    storniert: ['Storniert', 'bad']
  };
  const [label, klass] = map[status] || [status || 'Offen', 'warn'];
  return `<span class="pill ${klass}">${label}</span>`;
}

function assigneePill(order) {
  return order?.assigneeId
    ? `<span class="pill good">${escapeHtml(order.assigneeName || order.assignee?.username || order.assigneeId)}</span>`
    : '<span class="pill warn">frei</span>';
}

function fillChannelSelect(id, channels, preferredId) {
  const select = $(id);
  const current = select.value || preferredId || '';
  select.replaceChildren();

  channels.forEach(channel => {
    const option = document.createElement('option');
    option.value = channel.id;
    option.textContent = `${channel.parentName ? `${channel.parentName} / ` : ''}#${channel.name}`;
    select.appendChild(option);
  });

  if (current && [...select.options].some(option => option.value === current)) {
    select.value = current;
  }
}

function fillStaffSelect(staff, selectedId) {
  const select = $('orderAssigneeSelect');
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Nicht zugewiesen';
  select.appendChild(empty);

  staff.forEach(member => {
    const option = document.createElement('option');
    option.value = member.userId;
    option.textContent = member.username;
    select.appendChild(option);
  });

  select.value = selectedId || '';
}

function renderShopItems(items) {
  const list = $('shopItemList');
  list.replaceChildren();

  if (!items.length) {
    list.appendChild(emptyNode('Keine Stock-Items gefunden.'));
    return;
  }

  items.forEach(item => {
    const label = document.createElement('label');
    label.className = 'check-row';
    label.innerHTML = `
      <input type="checkbox" value="${escapeHtml(item.id)}" checked>
      <span>${stockNameHtml(item)} <span class="data-sub">${escapeHtml(item.price)} - ${item.amount} auf Lager</span></span>
    `;
    list.appendChild(label);
  });
}

function renderManagementMessages(targetId, messages) {
  const box = $(targetId);
  box.replaceChildren();

  if (!messages?.length) {
    box.appendChild(emptyNode('Keine Nachrichten gefunden.'));
    return;
  }

  messages.forEach(message => {
    const item = document.createElement('article');
    item.className = 'log-message';

    const author = document.createElement('strong');
    author.textContent = message.author || 'Unbekannt';
    const time = document.createElement('time');
    time.textContent = formatTime(message.timestamp);
    author.appendChild(time);
    item.appendChild(author);

    if (message.content) {
      const content = document.createElement('div');
      content.className = 'message-content';
      content.innerHTML = renderDiscordMarkdown(message.content);
      item.appendChild(content);
    }

    if (message.embeds?.length) {
      message.embeds.forEach(embed => {
        const preview = document.createElement('div');
        preview.className = 'embed-preview';
        preview.innerHTML = `
          ${embed.title ? `<b>${escapeHtml(embed.title)}</b>` : ''}
          ${embed.description ? `<div>${renderDiscordMarkdown(embed.description)}</div>` : ''}
          ${(embed.fields || []).map(field => `<div><b>${escapeHtml(field.name)}</b>${renderDiscordMarkdown(field.value)}</div>`).join('')}
        `;
        item.appendChild(preview);
      });
    }

    if (message.attachments?.length) {
      const links = document.createElement('div');
      links.className = 'attachments';
      message.attachments.forEach(file => {
        const link = document.createElement('a');
        link.href = file.url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = file.name || 'Anhang';
        links.appendChild(link);
      });
      item.appendChild(links);
    }

    box.appendChild(item);
  });
}

function renderTicketRows(targetId, tickets, selectFn, selectedId) {
  const list = $(targetId);
  list.replaceChildren();

  if (!tickets.length) {
    list.appendChild(emptyNode('Keine Einträge gefunden.'));
    return;
  }

  tickets.forEach(ticket => {
    const row = rowText(
      `#${ticket.name}`,
      `${ticketTypeLabel(ticket.type)} - ${ticket.owner?.username || ticket.ownerId || 'Unbekannt'} - ${formatTime(ticket.createdAt, true)}`,
      ticketStatePill(ticket.state)
    );
    row.style.cursor = 'pointer';
    row.classList.toggle('active', ticket.channelId === selectedId);
    row.addEventListener('click', () => selectFn(ticket.channelId));
    list.appendChild(row);
  });
}

async function loadTickets() {
  const params = new URLSearchParams();
  params.set('state', state.ticketState);
  params.set('type', state.ticketType);
  const data = await api(`/api/dashboard/tickets?${params.toString()}`);
  state.tickets = data.tickets || [];
  renderTicketRows('ticketList', state.tickets, selectTicket, state.selectedTicketId);
}

function setTicketDetailEnabled(enabled) {
  ['ticketOpenBtn', 'ticketCloseBtn', 'ticketReopenBtn', 'ticketTranscriptBtn', 'ticketNoteSaveBtn', 'ticketSendMessageBtn'].forEach(id => {
    $(id).disabled = !enabled;
  });
  $('ticketNote').disabled = !enabled;
  $('ticketMessageText').disabled = !enabled;
}

function renderTicketDetail(data) {
  state.selectedTicket = data?.ticket || null;
  const ticket = state.selectedTicket;
  $('ticketDetailTitle').textContent = ticket ? `#${ticket.name}` : 'Kein Ticket ausgewählt';
  $('ticketDetailMeta').replaceChildren();
  renderManagementMessages('ticketMessages', data?.messages || []);
  setTicketDetailEnabled(Boolean(ticket));

  if (!ticket) {
    $('ticketDetailMeta').appendChild(emptyNode('Wähle links ein Ticket aus.'));
    $('ticketNote').value = '';
    return;
  }

  $('ticketDetailMeta').append(
    rowText('Owner', ticket.owner?.username || ticket.ownerId || 'Unbekannt', ticket.ownerId ? `<span class="pill">${ticket.ownerId}</span>` : ''),
    rowText('Typ', ticketTypeLabel(ticket.type), ticketStatePill(ticket.state)),
    rowText('Order', ticket.orderId || 'none', `<span class="pill">${formatTime(ticket.createdAt, true)}</span>`)
  );
  $('ticketNote').value = ticket.note || '';
  $('ticketCloseBtn').disabled = ticket.state === 'closed';
  $('ticketReopenBtn').disabled = ticket.state !== 'closed';
}

async function selectTicket(channelId) {
  state.selectedTicketId = channelId;
  renderTicketRows('ticketList', state.tickets, selectTicket, state.selectedTicketId);
  const data = await api(`/api/dashboard/tickets/${encodeURIComponent(channelId)}`);
  renderTicketDetail(data);
  revealOnPhone(document.querySelector('#ticketsView .management-layout > :nth-child(2)'));
}

async function sendTicketMessage() {
  return withPending(`ticketMessage:${state.selectedTicketId || 'none'}`, async () => {
    if (!state.selectedTicketId) return;
    const content = $('ticketMessageText').value.trim();
    if (!content) return;

    const data = await api(`/api/dashboard/tickets/${encodeURIComponent(state.selectedTicketId)}/message`, {
      method: 'POST',
      body: { content }
    });
    $('ticketMessageText').value = '';
    renderTicketDetail(data);
    showToast('Nachricht ins Ticket gesendet.');
  });
}

async function saveTicketNote() {
  return withPending(`ticketNote:${state.selectedTicketId || 'none'}`, async () => {
    if (!state.selectedTicketId) return;
    await api(`/api/dashboard/tickets/${encodeURIComponent(state.selectedTicketId)}/meta`, {
      method: 'PATCH',
      body: { note: $('ticketNote').value }
    });
    await selectTicket(state.selectedTicketId);
    await loadTickets();
    showToast('Ticket-Notiz gespeichert.');
  });
}

async function closeSelectedTicket() {
  return withPending(`ticketClose:${state.selectedTicketId || 'none'}`, async () => {
    if (!state.selectedTicketId) return;
    await api(`/api/dashboard/tickets/${encodeURIComponent(state.selectedTicketId)}/close`, {
      method: 'POST',
      body: { reason: 'Per Dashboard geschlossen' }
    });
    await loadTickets();
    await selectTicket(state.selectedTicketId);
    showToast('Ticket geschlossen.');
  });
}

async function reopenSelectedTicket() {
  return withPending(`ticketReopen:${state.selectedTicketId || 'none'}`, async () => {
    if (!state.selectedTicketId) return;
    await api(`/api/dashboard/tickets/${encodeURIComponent(state.selectedTicketId)}/reopen`, {
      method: 'POST'
    });
    await loadTickets();
    await selectTicket(state.selectedTicketId);
    showToast('Ticket wieder geöffnet.');
  });
}

async function downloadTicketTranscript() {
  if (!state.selectedTicketId) return;
  const data = await api(`/api/dashboard/tickets/${encodeURIComponent(state.selectedTicketId)}/transcript`);
  const blob = new Blob([data.transcript || ''], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = data.fileName || 'transcript.txt';
  link.click();
  URL.revokeObjectURL(link.href);
}

function openSelectedTicket() {
  if (state.selectedTicket?.url) window.open(state.selectedTicket.url, '_blank', 'noreferrer');
}

async function loadOrders() {
  const params = new URLSearchParams();
  params.set('status', state.orderStatus);
  const data = await api(`/api/dashboard/orders?${params.toString()}`);
  state.orders = data.orders || [];
  renderOrderRows();
}

function renderOrderRows() {
  const list = $('orderList');
  list.replaceChildren();

  if (!state.orders.length) {
    list.appendChild(emptyNode('Keine Bestellungen gefunden.'));
    return;
  }

  state.orders.forEach(order => {
    const row = rowText(
      `#${order.orderId} - ${order.owner?.username || order.ownerId || 'Unbekannt'}`,
      `${order.name} - ${order.assigneeName || 'frei'} - ${formatTime(order.createdAt, true)}`,
      `${assigneePill(order)} ${orderStatusPill(order.status)}`
    );
    row.style.cursor = 'pointer';
    row.classList.toggle('active', order.channelId === state.selectedOrderId);
    row.addEventListener('click', () => selectOrder(order.channelId));
    list.appendChild(row);
  });
}

function setOrderDetailEnabled(enabled) {
  [
    'orderStatusSelect',
    'orderAssigneeSelect',
    'orderNote',
    'orderSaveBtn',
    'orderAssignBtn',
    'orderCompleteBtn',
    'orderOpenBtn',
    'orderCloseBtn',
    'orderInvoiceBtn',
    'invoiceItems',
    'invoiceTotal',
    'invoicePayment',
    'invoiceIngame',
    'invoiceNote'
  ].forEach(id => {
    $(id).disabled = !enabled;
  });
}

function renderOrderDetail(data) {
  state.selectedOrder = data?.order || null;
  state.selectedInvoice = data?.invoice || null;
  state.staff = data?.staff || state.staff || [];
  const order = state.selectedOrder;
  $('orderDetailTitle').textContent = order ? `Bestellung #${order.orderId}` : 'Keine Bestellung ausgewählt';
  $('orderDetailMeta').replaceChildren();
  renderManagementMessages('orderMessages', data?.messages || []);
  setOrderDetailEnabled(Boolean(order));

  if (!order) {
    $('orderDetailMeta').appendChild(emptyNode('Wähle links eine Bestellung aus.'));
    $('orderNote').value = '';
    fillStaffSelect([], '');
    $('invoiceItems').value = '';
    $('invoiceTotal').value = '';
    $('invoicePayment').value = '';
    $('invoiceIngame').value = '';
    $('invoiceNote').value = '';
    return;
  }

  $('orderDetailMeta').append(
    rowText('Kunde', order.owner?.username || order.ownerId || 'Unbekannt', order.ownerId ? `<span class="pill">${order.ownerId}</span>` : ''),
    rowText('Ticket', order.name, ticketStatePill(order.state)),
    rowText('Status', order.status, orderStatusPill(order.status)),
    rowText('Bearbeiter', order.assigneeName || 'Nicht zugewiesen', assigneePill(order)),
    rowText('Rechnung', order.invoiceSentAt ? `gesendet ${formatTime(order.invoiceSentAt, true)}` : 'noch nicht gesendet', '<span class="pill">Invoice</span>')
  );
  $('orderStatusSelect').value = order.status || 'offen';
  fillStaffSelect(state.staff, order.assigneeId || '');
  $('orderNote').value = order.note || '';
  $('invoiceItems').value = state.selectedInvoice?.itemsText || '';
  $('invoiceTotal').value = state.selectedInvoice?.total || '';
  $('invoicePayment').value = state.selectedInvoice?.payment || '';
  $('invoiceIngame').value = state.selectedInvoice?.ingame || '';
  $('invoiceNote').value = state.selectedInvoice?.note || '';
  $('orderCloseBtn').disabled = order.state === 'closed';
  $('orderCompleteBtn').disabled = order.status === 'fertig';
}

async function selectOrder(channelId) {
  state.selectedOrderId = channelId;
  renderOrderRows();
  const data = await api(`/api/dashboard/orders/${encodeURIComponent(channelId)}`);
  renderOrderDetail(data);
  revealOnPhone(document.querySelector('#ordersView .management-layout > :nth-child(2)'));
}

async function saveOrderStatus() {
  return withPending(`orderSave:${state.selectedOrderId || 'none'}`, async () => {
    if (!state.selectedOrderId) return;
    const data = await api(`/api/dashboard/orders/${encodeURIComponent(state.selectedOrderId)}`, {
      method: 'PATCH',
      body: {
        status: $('orderStatusSelect').value,
        note: $('orderNote').value
      }
    });
    renderOrderDetail(data);
    await loadOrders();
    showToast('Bestellung gespeichert.');
  });
}

async function completeOrder() {
  return withPending(`orderComplete:${state.selectedOrderId || 'none'}`, async () => {
    if (!state.selectedOrderId) return;
    const data = await api(`/api/dashboard/orders/${encodeURIComponent(state.selectedOrderId)}/complete`, {
      method: 'POST'
    });
    renderOrderDetail(data);
    await loadOrders();
    showToast('Bestellung fertig markiert und Bewertungsbutton gesendet.');
  });
}

async function assignOrder() {
  return withPending(`orderAssign:${state.selectedOrderId || 'none'}`, async () => {
    if (!state.selectedOrderId) return;
    const data = await api(`/api/dashboard/orders/${encodeURIComponent(state.selectedOrderId)}/assign`, {
      method: 'POST',
      body: { staffId: $('orderAssigneeSelect').value }
    });
    renderOrderDetail(data);
    await loadOrders();
    showToast($('orderAssigneeSelect').value ? 'Bestellung zugewiesen.' : 'Bearbeiter entfernt.');
  });
}

async function sendOrderInvoiceFromDashboard() {
  return withPending(`orderInvoice:${state.selectedOrderId || 'none'}`, async () => {
    if (!state.selectedOrderId) return;
    const data = await api(`/api/dashboard/orders/${encodeURIComponent(state.selectedOrderId)}/invoice`, {
      method: 'POST',
      body: {
        itemsText: $('invoiceItems').value,
        total: $('invoiceTotal').value,
        payment: $('invoicePayment').value,
        ingame: $('invoiceIngame').value,
        note: $('invoiceNote').value
      }
    });
    renderOrderDetail(data);
    await loadOrders();
    showToast('Rechnung ins Ticket gesendet.');
  });
}

function openSelectedOrder() {
  if (state.selectedOrder?.url) window.open(state.selectedOrder.url, '_blank', 'noreferrer');
}

async function closeSelectedOrder() {
  return withPending(`orderClose:${state.selectedOrderId || 'none'}`, async () => {
    if (!state.selectedOrderId) return;
    await api(`/api/dashboard/tickets/${encodeURIComponent(state.selectedOrderId)}/close`, {
      method: 'POST',
      body: { reason: 'Bestellung per Dashboard geschlossen' }
    });
    await loadOrders();
    await selectOrder(state.selectedOrderId);
    showToast('Order-Ticket geschlossen.');
  });
}

async function loadShop() {
  const data = await api('/api/dashboard/shop');
  state.shopStock = data.stock || [];
  state.shopChannels = data.channels || [];

  fillChannelSelect('shopPanelChannel', state.shopChannels, data.defaultChannelId);
  fillChannelSelect('saleChannel', state.shopChannels, data.defaultChannelId);

  const saleItem = $('saleItem');
  const selectedSaleItem = saleItem.value;
  saleItem.replaceChildren();
  state.shopStock.forEach(item => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name} - ${item.price}`;
    saleItem.appendChild(option);
  });
  if (selectedSaleItem && [...saleItem.options].some(option => option.value === selectedSaleItem)) {
    saleItem.value = selectedSaleItem;
  }

  if (!$('saleTitle').value && data.latestOffer?.title) $('saleTitle').value = data.latestOffer.title;
  renderShopItems(state.shopStock);
}

async function postShopPanel(event) {
  event.preventDefault();
  return withPending('shopPanelPost', async () => {
    const itemIds = [...$('shopItemList').querySelectorAll('input[type="checkbox"]:checked')]
      .map(input => input.value);

    const data = await api('/api/dashboard/shop/panel', {
      method: 'POST',
      body: {
        channelId: $('shopPanelChannel').value,
        title: $('shopPanelTitle').value,
        description: $('shopPanelDescription').value,
        itemIds,
        includeSale: $('shopPanelIncludeSale').checked
      }
    });

    showToast('Shop-Panel gepostet.');
    if (data.messageUrl) window.open(data.messageUrl, '_blank', 'noreferrer');
  });
}

async function postSale(event) {
  event.preventDefault();
  return withPending('shopSalePost', async () => {
    const selected = state.shopStock.find(item => item.id === $('saleItem').value);
    const data = await api('/api/dashboard/shop/sale', {
      method: 'POST',
      body: {
        channelId: $('saleChannel').value,
        itemId: $('saleItem').value,
        itemName: selected?.name || '',
        title: $('saleTitle').value,
        discount: $('saleDiscount').value,
        until: $('saleUntil').value,
        description: $('saleDescription').value,
        mentionDeals: $('saleMentionDeals').checked
      }
    });

    showToast('Angebot gepostet.');
    if (data.offer?.messageUrl) window.open(data.offer.messageUrl, '_blank', 'noreferrer');
    await loadShop();
  });
}

async function loadOverview() {
  const data = await api('/api/dashboard/overview');
  const overview = data.overview;
  const metrics = $('overviewMetrics');
  metrics.replaceChildren(
    renderMetric('Server', overview.guild.memberCount ?? '-', `${overview.guild.name} - ${overview.guild.activeTickets} offene Tickets`),
    renderMetric('DMs', overview.dms.unread, `${overview.dms.open} offen, ${overview.dms.archived} archiviert`),
    renderMetric('Stock', `${overview.stock.low + overview.stock.out}`, `${overview.stock.low} niedrig, ${overview.stock.out} ausverkauft`),
    renderMetric('Bot', formatDuration(overview.bot.uptimeSeconds), `${overview.bot.presence.status} - ${overview.bot.presence.activityName || 'keine Aktivität'}`)
  );

  const invites = $('overviewInvites');
  invites.replaceChildren();
  if (!overview.invites.top.length) {
    invites.appendChild(emptyNode('Noch keine Invites.'));
  } else {
    overview.invites.top.forEach(row => {
      const item = rowText(`#${row.rank} ${row.username}`, row.userId, `<span class="pill good">${row.invites} Invites</span>`);
      item.querySelector('.data-main').prepend(avatarNode(row));
      invites.appendChild(item);
    });
  }

  const stock = $('overviewStock');
  stock.replaceChildren();
  const important = overview.stock.items.filter(item => item.status !== 'ok');
  if (!important.length) {
    stock.appendChild(rowText('Alles gut', 'Keine niedrigen oder leeren Stock-Items.', '<span class="pill good">OK</span>'));
  } else {
    important.forEach(item => {
      const klass = item.status === 'out' ? 'bad' : 'warn';
      const label = item.status === 'out' ? 'Ausverkauft' : 'Niedrig';
      stock.appendChild(rowHtml(stockNameHtml(item), `${item.price} - ${item.amount} auf Lager`, `<span class="pill ${klass}">${label}</span>`));
    });
  }
}

async function loadPresence() {
  const data = await api('/api/dashboard/presence');
  const presence = data.presence;
  $('presenceStatus').value = presence.status === 'invisible' ? 'offline' : presence.status;
  $('presenceActivityType').value = presence.activityType || 'Watching';
  $('presenceActivityName').value = presence.activityName || '';
  $('presenceActivityUrl').value = presence.activityUrl || '';
}

async function savePresence(event) {
  event.preventDefault();
  try {
    const data = await api('/api/dashboard/presence', {
      method: 'PATCH',
      body: {
        status: $('presenceStatus').value,
        activityType: $('presenceActivityType').value,
        activityName: $('presenceActivityName').value,
        activityUrl: $('presenceActivityUrl').value
      }
    });
    $('presenceStatus').value = data.presence.status === 'invisible' ? 'offline' : data.presence.status;
    showToast('Bot-Status gespeichert.');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function loadInvites() {
  const data = await api('/api/dashboard/invites');
  const list = $('inviteList');
  list.replaceChildren();

  if (!data.invites.length) {
    list.appendChild(emptyNode('Noch keine Invites gespeichert.'));
    return;
  }

  data.invites.forEach(row => {
    const item = rowText(`#${row.rank} ${row.username}`, row.userId, `<span class="pill good">${row.invites}</span>`);
    item.querySelector('.data-main').prepend(avatarNode(row));
    list.appendChild(item);
  });
}

async function saveInviteAmount(event) {
  event.preventDefault();
  const userId = $('inviteUserId').value.trim();
  const amount = Number($('inviteAmount').value);

  try {
    await api(`/api/dashboard/invites/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: { amount }
    });
    $('inviteUserId').value = '';
    $('inviteAmount').value = '';
    await loadInvites();
    showToast('Invites gespeichert und Leaderboard aktualisiert.');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function loadStock() {
  const data = await api('/api/dashboard/stock');
  state.stock = data.stock || [];
  renderStock();
}

function renderStock() {
  const list = $('stockList');
  list.replaceChildren();

  if (!state.stock.length) {
    list.appendChild(emptyNode('Keine Stock-Items gefunden.'));
    return;
  }

  state.stock.forEach(item => {
    const row = document.createElement('div');
    row.className = 'data-row stock-row';
    const title = document.createElement('div');
    title.innerHTML = `
      <div class="data-title">${stockNameHtml(item)}</div>
      <div class="data-sub">${escapeHtml(item.id)}</div>
    `;

    const edits = document.createElement('div');
    edits.className = 'stock-edit';
    edits.innerHTML = `
      <input id="stockEmoji_${item.id}" value="${escapeHtml(item.emoji || '')}" aria-label="Emoji">
      <input id="stockName_${item.id}" value="${escapeHtml(item.name)}" aria-label="Name">
      <input id="stockPrice_${item.id}" value="${escapeHtml(item.price)}" aria-label="Preis">
    `;

    const amount = document.createElement('input');
    amount.id = `stockAmount_${item.id}`;
    amount.type = 'number';
    amount.min = '0';
    amount.step = '1';
    amount.value = String(item.amount || 0);
    amount.setAttribute('aria-label', 'Menge');

    const save = document.createElement('button');
    save.className = 'primary small';
    save.type = 'button';
    save.textContent = 'Speichern';
    save.addEventListener('click', () => saveStockItem(item.id));

    const remove = document.createElement('button');
    remove.className = 'danger small';
    remove.type = 'button';
    remove.textContent = 'Löschen';
    remove.addEventListener('click', () => deleteStockItem(item.id, item.name));

    const actions = document.createElement('div');
    actions.className = 'stock-actions';
    actions.append(save, remove);

    row.append(title, edits, amount, actions);
    list.appendChild(row);
  });
}

async function createStockItem(event) {
  event.preventDefault();
  const name = $('stockNewName').value.trim();
  const price = $('stockNewPrice').value.trim();
  const id = stockIdFromName($('stockNewId').value || name);
  const amount = Number($('stockNewAmount').value || 0);

  if (!name || !price || !id) {
    showToast('Name, Preis und gültige ID eintragen.', true);
    return;
  }

  return withPending('stock:create', async () => {
    try {
      const data = await api('/api/dashboard/stock', {
        method: 'POST',
        body: {
          id,
          emoji: $('stockNewEmoji').value,
          name,
          price,
          amount
        }
      });
      state.stock = data.stock || [];
      resetStockCreateForm();
      renderStock();
      showToast('Item erstellt und Discord-Panel aktualisiert.');
    } catch (error) {
      showToast(error.message, true);
    }
  });
}

async function saveStockItem(itemId) {
  return withPending(`stock:${itemId}`, async () => {
    try {
      const data = await api(`/api/dashboard/stock/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        body: {
          emoji: $(`stockEmoji_${itemId}`).value,
          name: $(`stockName_${itemId}`).value,
          price: $(`stockPrice_${itemId}`).value,
          amount: Number($(`stockAmount_${itemId}`).value)
        }
      });
      state.stock = data.stock || [];
      renderStock();
      showToast('Stock gespeichert und Discord-Panel aktualisiert.');
    } catch (error) {
      showToast(error.message, true);
    }
  });
}

async function deleteStockItem(itemId, itemName) {
  if (!confirm(`${itemName || itemId} wirklich aus dem Stock entfernen?`)) return;

  return withPending(`stock:delete:${itemId}`, async () => {
    try {
      const data = await api(`/api/dashboard/stock/${encodeURIComponent(itemId)}`, {
        method: 'DELETE'
      });
      state.stock = data.stock || [];
      renderStock();
      showToast('Item entfernt und Discord-Panel aktualisiert.');
    } catch (error) {
      showToast(error.message, true);
    }
  });
}

async function lookupUser(event) {
  event.preventDefault();
  const userId = $('lookupUserId').value.trim();
  try {
    const data = await api(`/api/dashboard/users/${encodeURIComponent(userId)}`);
    renderUserInfo('lookupUserInfo', data.userInfo, 'Noch kein User geladen.');
  } catch (error) {
    showToast(error.message, true);
  }
}

function emptyNode(text) {
  const node = document.createElement('div');
  node.className = 'empty';
  node.textContent = text;
  return node;
}

function setActionButtons(thread) {
  $('copyIdBtn').disabled = !thread;
  $('archiveBtn').disabled = !thread;
  $('deleteThreadBtn').disabled = !thread;
  $('replyText').disabled = !thread;
  $('replyFiles').disabled = !thread;
  $('replyBtn').disabled = !thread;
  $('archiveBtn').textContent = thread?.archived ? 'Wiederherstellen' : 'Archivieren';
}

function renderThreads() {
  const list = $('threadList');
  list.replaceChildren();

  if (!state.threads.length) {
    list.appendChild(emptyNode(state.search ? 'Keine passenden DMs gefunden.' : 'Noch keine DMs gespeichert.'));
    return;
  }

  state.threads.forEach(thread => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `thread${thread.userId === state.selectedUserId ? ' active' : ''}${thread.archived ? ' archived' : ''}`;
    button.addEventListener('click', () => selectThread(thread.userId));

    const main = document.createElement('div');
    main.className = 'thread-main';

    const name = document.createElement('div');
    name.className = 'thread-name';
    name.textContent = thread.globalName || thread.username || thread.userId;

    const last = document.createElement('div');
    last.className = 'thread-last';
    last.textContent = preview(thread);

    const tags = document.createElement('div');
    tags.className = 'thread-tags';

    if (thread.answered) {
      const answered = document.createElement('span');
      answered.className = 'tiny-tag good';
      answered.textContent = 'beantwortet';
      tags.appendChild(answered);
    }

    if (thread.archived) {
      const archived = document.createElement('span');
      archived.className = 'tiny-tag';
      archived.textContent = 'archiviert';
      tags.appendChild(archived);
    }

    if (thread.unreadCount > 0) {
      const unread = document.createElement('span');
      unread.className = 'tiny-tag warn';
      unread.textContent = 'ungelesen';
      tags.appendChild(unread);
    }

    main.append(name, last);
    if (tags.childElementCount) main.appendChild(tags);
    button.append(avatarNode(thread), main);

    if (thread.unreadCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = String(thread.unreadCount);
      button.appendChild(badge);
    }

    list.appendChild(button);
  });
}

function setSelectedHeader(thread) {
  state.selectedThread = thread || null;
  $('selectedName').textContent = thread ? (thread.globalName || thread.username || thread.userId) : 'Kein Thread ausgewählt';
  $('selectedId').textContent = thread ? thread.userId : 'User-ID';
  setActionButtons(thread);

  const holder = $('selectedAvatar');
  const parent = holder.parentElement;
  const next = avatarNode(thread || { username: '?' });
  next.id = 'selectedAvatar';
  parent.replaceChild(next, holder);
}

function renderMessages(thread) {
  const box = $('messages');
  box.replaceChildren();

  if (!thread?.messages?.length) {
    box.appendChild(emptyNode(thread ? 'Keine Nachrichten in diesem Thread.' : 'Wähle links einen DM-Thread aus.'));
    return;
  }

  thread.messages.forEach(message => {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${message.direction === 'out' ? 'out' : 'in'}`;

    if (message.content) {
      const content = document.createElement('div');
      content.className = 'message-content';
      content.innerHTML = renderDiscordMarkdown(message.content);
      bubble.appendChild(content);
    }

    if (message.attachments?.length) {
      const links = document.createElement('div');
      links.className = 'attachments';
      message.attachments.forEach(file => {
        const link = document.createElement('a');
        link.href = file.url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = file.name || 'Anhang';
        links.appendChild(link);
      });
      bubble.appendChild(links);
    }

    const meta = document.createElement('div');
    meta.className = 'bubble-meta';
    meta.textContent = `${message.direction === 'out' ? 'Bot' : 'User'} - ${formatTime(message.timestamp)}`;
    bubble.appendChild(meta);
    box.appendChild(bubble);
  });

  box.scrollTop = box.scrollHeight;
}

function renderUserInfo(containerId, info, emptyText = 'Kein User ausgewählt.') {
  const box = $(containerId);
  box.className = info ? 'info-card' : 'empty';
  box.replaceChildren();

  if (!info) {
    box.textContent = emptyText;
    return;
  }

  const overview = document.createElement('section');
  overview.className = 'info-section';
  overview.append(sectionTitle('Übersicht'));
  overview.append(infoRow('User', info.tag || info.userId));
  overview.append(infoRow('Server', info.inGuild ? 'auf dem Server' : 'nicht auf dem Server'));
  overview.append(infoRow('Join-Datum', info.joinedAt ? formatTime(info.joinedAt, true) : '-'));
  overview.append(infoRow('Account', info.createdAt ? formatTime(info.createdAt, true) : '-'));
  overview.append(infoRow('Invites', String(info.invites || 0)));
  overview.append(infoRow('Warnungen', String(info.warningsCount || 0)));

  const roles = document.createElement('section');
  roles.className = 'info-section';
  roles.append(sectionTitle('Rollen'));
  const roleList = document.createElement('div');
  roleList.className = 'role-list';
  if (info.roles?.length) {
    info.roles.forEach(role => {
      const chip = document.createElement('span');
      chip.className = 'role-chip';
      chip.textContent = role.name;
      if (role.color) chip.style.borderColor = role.color;
      roleList.appendChild(chip);
    });
  } else {
    roleList.textContent = 'Keine Rollen gefunden.';
    roleList.style.color = 'var(--muted)';
    roleList.style.fontSize = '13px';
  }
  roles.appendChild(roleList);

  const warnings = document.createElement('section');
  warnings.className = 'info-section';
  warnings.append(sectionTitle('Letzte Warnungen'));
  const warningList = document.createElement('div');
  warningList.className = 'warning-list';
  if (info.warnings?.length) {
    info.warnings.forEach(warning => {
      const item = document.createElement('div');
      item.className = 'warning-item';
      item.textContent = `#${warning.number}: ${warning.reason} - ${formatTime(warning.timestamp, true)}`;
      warningList.appendChild(item);
    });
  } else {
    warningList.textContent = 'Keine Warnungen.';
    warningList.style.color = 'var(--muted)';
    warningList.style.fontSize = '13px';
  }
  warnings.appendChild(warningList);

  box.append(overview, roles, warnings);
}

function sectionTitle(text) {
  const title = document.createElement('h3');
  title.textContent = text;
  return title;
}

function infoRow(label, value) {
  const row = document.createElement('div');
  row.className = 'info-row';
  const left = document.createElement('span');
  left.textContent = label;
  const right = document.createElement('strong');
  right.textContent = value;
  row.append(left, right);
  return row;
}

function clearSelection() {
  state.selectedUserId = null;
  state.selectedThread = null;
  setSelectedHeader(null);
  renderMessages(null);
  renderUserInfo('dmUserInfo', null);
  $('replyText').value = '';
  $('replyFiles').value = '';
  updateFileList('replyFiles', 'replyFileList');
}

async function loadThreads() {
  const params = new URLSearchParams();
  params.set('filter', state.filter);
  if (state.search) params.set('search', state.search);

  const data = await api(`/api/dashboard/threads?${params.toString()}`);
  state.threads = data.threads || [];
  renderThreads();
}

async function refreshDashboard() {
  await loadThreads();
  if (!state.selectedUserId) return;

  try {
    const data = await api(`/api/dashboard/threads/${encodeURIComponent(state.selectedUserId)}`);
    setSelectedHeader(data.thread);
    renderMessages(data.thread);
    renderUserInfo('dmUserInfo', data.thread?.userInfo);
  } catch (error) {
    if (error.status === 404) {
      clearSelection();
      await loadThreads();
      return;
    }
    throw error;
  }
}

async function selectThread(userId) {
  state.selectedUserId = userId;
  renderThreads();
  const data = await api(`/api/dashboard/threads/${encodeURIComponent(userId)}`);
  setSelectedHeader(data.thread);
  renderMessages(data.thread);
  renderUserInfo('dmUserInfo', data.thread?.userInfo);
  revealOnPhone(document.querySelector('#dmView .conversation'));
  await loadThreads();
}

function updateFileList(inputId, targetId) {
  const files = Array.from($(inputId).files || []);
  const target = $(targetId);
  if (!files.length) {
    target.textContent = '';
    return;
  }

  target.textContent = files
    .slice(0, MAX_FILES)
    .map(file => `${file.name} (${Math.ceil(file.size / 1024)} KB)`)
    .join(', ');
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      contentType: file.type || null,
      data: reader.result
    });
    reader.onerror = () => reject(new Error(`${file.name} konnte nicht gelesen werden.`));
    reader.readAsDataURL(file);
  });
}

async function readAttachments(inputId) {
  const files = Array.from($(inputId).files || []);
  if (!files.length) return [];
  if (files.length > MAX_FILES) throw new Error(`Maximal ${MAX_FILES} Anhänge pro Nachricht.`);

  let total = 0;
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} ist größer als 8 MB.`);
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) throw new Error('Die Anhänge sind zusammen größer als 12 MB.');

  return Promise.all(files.map(readFileAsDataUrl));
}

async function sendReply() {
  return withPending(`dmReply:${state.selectedUserId || 'none'}`, async () => {
    if (!state.selectedUserId) return;
    $('replyBtn').disabled = true;
    try {
      const content = $('replyText').value.trim();
      const attachments = await readAttachments('replyFiles');
      if (!content && !attachments.length) return;

      const data = await api(`/api/dashboard/threads/${encodeURIComponent(state.selectedUserId)}/messages`, {
        method: 'POST',
        body: { content, attachments }
      });
      $('replyText').value = '';
      $('replyFiles').value = '';
      updateFileList('replyFiles', 'replyFileList');
      setSelectedHeader(data.thread);
      renderMessages(data.thread);
      renderUserInfo('dmUserInfo', data.thread?.userInfo);
      await loadThreads();
      showToast('DM gesendet.');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      $('replyBtn').disabled = !state.selectedUserId;
    }
  });
}

async function sendNewDm() {
  return withPending('dmNew', async () => {
    $('newSendBtn').disabled = true;
    try {
      const userId = $('newUserId').value.trim();
      const content = $('newMessage').value.trim();
      const attachments = await readAttachments('newFiles');
      if (!userId || (!content && !attachments.length)) {
        return showToast('User-ID und Nachricht oder Anhang eintragen.', true);
      }

      const data = await api('/api/dashboard/dm', {
        method: 'POST',
        body: { userId, content, attachments }
      });
      $('newMessage').value = '';
      $('newFiles').value = '';
      updateFileList('newFiles', 'newFileList');
      state.selectedUserId = userId;
      setSelectedHeader(data.thread);
      renderMessages(data.thread);
      renderUserInfo('dmUserInfo', data.thread?.userInfo);
      await loadThreads();
      showToast('DM gesendet.');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      $('newSendBtn').disabled = false;
    }
  });
}

async function toggleArchive() {
  return withPending(`dmArchive:${state.selectedUserId || 'none'}`, async () => {
    if (!state.selectedUserId || !state.selectedThread) return;
    const archived = !state.selectedThread.archived;

    try {
      const data = await api(`/api/dashboard/threads/${encodeURIComponent(state.selectedUserId)}`, {
        method: 'PATCH',
        body: { archived }
      });
      setSelectedHeader(data.thread);
      renderMessages(data.thread);
      renderUserInfo('dmUserInfo', data.thread?.userInfo);
      await loadThreads();
      showToast(archived ? 'Thread archiviert.' : 'Thread wiederhergestellt.');
    } catch (error) {
      showToast(error.message, true);
    }
  });
}

async function deleteThread() {
  return withPending(`dmDelete:${state.selectedUserId || 'none'}`, async () => {
    if (!state.selectedUserId) return;
    const ok = confirm('Diesen DM-Thread wirklich löschen? Neue DMs vom User legen später wieder einen Thread an.');
    if (!ok) return;

    try {
      await api(`/api/dashboard/threads/${encodeURIComponent(state.selectedUserId)}`, {
        method: 'DELETE'
      });
      clearSelection();
      await loadThreads();
      showToast('Thread gelöscht.');
    } catch (error) {
      showToast(error.message, true);
    }
  });
}

function sendOnEnter(event, sendFn) {
  if (event.key !== 'Enter' || event.shiftKey) return;
  event.preventDefault();
  sendFn().catch(error => showToast(error.message, true));
}


// ── Statistik ──
state.statsRange = 30;
const euro = value => `${Number(value || 0).toFixed(2).replace('.', ',')} €`;
const shortDate = key => { const [, m, d] = key.split('-'); return `${d}.${m}.`; };

function renderBarChart(chartId, axisId, days, field, format) {
  const chart = $(chartId);
  chart.replaceChildren();
  const max = Math.max(0, ...days.map(d => d[field]));
  const tip = document.createElement('div');
  tip.className = 'chart-tip hidden';
  days.forEach(day => {
    const slot = document.createElement('div');
    slot.className = 'bar-slot';
    slot.tabIndex = 0;
    const bar = document.createElement('div');
    const value = day[field];
    bar.className = value ? 'bar' : 'bar zero';
    bar.style.height = max ? `${Math.max(2, (value / max) * 100)}%` : '1px';
    slot.appendChild(bar);
    const show = () => {
      tip.innerHTML = `<strong>${escapeHtml(format(value))}</strong>${escapeHtml(shortDate(day.date))}`;
      tip.classList.remove('hidden');
      const left = slot.offsetLeft + slot.offsetWidth / 2;
      tip.style.left = `${Math.min(Math.max(left, 50), chart.clientWidth - 50)}px`;
      tip.style.top = `${Math.max(0, chart.clientHeight - bar.offsetHeight - 6)}px`;
    };
    slot.addEventListener('mouseenter', show);
    slot.addEventListener('focus', show);
    slot.addEventListener('click', show);
    slot.addEventListener('mouseleave', () => tip.classList.add('hidden'));
    slot.addEventListener('blur', () => tip.classList.add('hidden'));
    chart.appendChild(slot);
  });
  chart.appendChild(tip);
  chart.setAttribute('aria-label', `Höchster Wert: ${format(max)}`);
  const axis = $(axisId);
  axis.replaceChildren();
  if (days.length) {
    const first = document.createElement('span'); first.textContent = shortDate(days[0].date);
    const top = document.createElement('span'); top.textContent = `max. ${format(max)}`;
    const last = document.createElement('span'); last.textContent = 'heute';
    axis.append(first, top, last);
  }
}

async function loadStats() {
  const data = await api(`/api/dashboard/stats?days=${state.statsRange}`);
  const st = data.stats;
  const t = st.totals;
  const r = st.reviews;
  const delivery = t.avgDeliveryMinutes === null ? '-'
    : t.avgDeliveryMinutes < 120 ? `${t.avgDeliveryMinutes} min` : `${Math.round(t.avgDeliveryMinutes / 60)} h`;
  $('statsMetrics').replaceChildren(
    renderMetric('Umsatz', euro(t.revenue), `Insgesamt ${euro(st.allTime.revenue)}`),
    renderMetric('Bestellungen', t.completed, `${t.orders} neu - Ø ${euro(t.averageOrder)}`),
    renderMetric('Lieferzeit', delivery, 'Ø von Bestellung bis fertig'),
    renderMetric('Mitglieder', st.memberCount ?? '-', `+${t.joins} neu, -${t.leaves} weg`),
    renderMetric('Bewertung', r.average === null ? '-' : `${String(r.average).replace('.', ',')} ★`, `${r.count} Bewertungen`)
  );

  const plain = v => String(v);
  renderBarChart('statsRevenueChart', 'statsRevenueAxis', st.days, 'revenue', euro);
  renderBarChart('statsOrdersChart', 'statsOrdersAxis', st.days, 'completed', plain);
  renderBarChart('statsJoinsChart', 'statsJoinsAxis', st.days, 'joins', plain);
  $('statsRevenueSum').textContent = euro(t.revenue);
  $('statsOrdersSum').textContent = `${t.completed} gesamt`;
  $('statsJoinsSum').textContent = `${t.joins} gesamt`;

  const top = $('statsTopItems');
  top.replaceChildren();
  if (!st.topItems.length) top.appendChild(emptyNode('Noch keine fertigen Bestellungen in diesem Zeitraum.'));
  st.topItems.forEach((item, i) => {
    top.appendChild(rowText(`${i + 1}. ${item.name}`, `${item.quantity}× insgesamt`, `<span class="pill">${item.orders} Bestellungen</span>`));
  });

  $('statsReviewAvg').textContent = r.average === null ? '' : `${String(r.average).replace('.', ',')} von 5`;
  const maxStars = Math.max(1, ...Object.values(r.counts));
  $('statsStars').replaceChildren(...[5, 4, 3, 2, 1].map(n => {
    const row = document.createElement('div');
    row.className = 'star-row';
    row.innerHTML = `<span>${n} ★</span><div class="star-track"><div class="star-fill" style="width:${(r.counts[n] || 0) / maxStars * 100}%"></div></div><span>${r.counts[n] || 0}</span>`;
    return row;
  }));
  const list = $('statsReviews');
  list.replaceChildren();
  if (!r.latest.length) list.appendChild(emptyNode('Noch keine Bewertungen gespeichert.'));
  r.latest.slice(0, 5).forEach(rv => {
    const card = document.createElement('div');
    card.className = 'review-card';
    card.innerHTML = `<strong>${'★'.repeat(rv.stars)}${'☆'.repeat(5 - rv.stars)}</strong> ${escapeHtml(rv.username || 'Kunde')}`
      + `<p>${escapeHtml(rv.text)}</p><small>${escapeHtml(rv.item ? `Gekauft: ${rv.item} - ` : '')}${new Date(rv.at).toLocaleDateString('de-DE')}</small>`;
    list.appendChild(card);
  });

  $('statsTable').replaceChildren(...st.days.slice().reverse().map(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${shortDate(d.date)}</td><td>${d.orders}</td><td>${d.completed}</td><td>${euro(d.revenue)}</td><td>${d.joins}</td><td>${d.leaves}</td>`;
    return tr;
  }));
}

document.querySelectorAll('[data-range]').forEach(button => {
  button.addEventListener('click', () => {
    state.statsRange = Number(button.dataset.range);
    document.querySelectorAll('[data-range]').forEach(b => b.classList.toggle('active', b === button));
    loadStats().catch(error => showToast(error.message, true));
  });
});

async function loadCurrentView() {
  if (state.currentView === 'overview') return loadOverview();
  if (state.currentView === 'stats') return loadStats();
  if (state.currentView === 'dms') return refreshDashboard();
  if (state.currentView === 'tickets') return loadTickets();
  if (state.currentView === 'orders') return loadOrders();
  if (state.currentView === 'presence') return loadPresence();
  if (state.currentView === 'invites') return loadInvites();
  if (state.currentView === 'stock') return loadStock();
  if (state.currentView === 'shop') return loadShop();
  if (state.currentView === 'users') return Promise.resolve();
  return Promise.resolve();
}

async function showView(view) {
  const targetId = view === 'dms' ? 'dmView' : `${view}View`;
  if (!$(targetId)) view = 'overview';
  state.currentView = view;
  localStorage.setItem('hugoDashboardCurrentView', view);
  document.querySelectorAll('.dashboard-view').forEach(section => {
    section.classList.toggle('hidden', section.id !== `${view}View` && !(view === 'dms' && section.id === 'dmView'));
  });
  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });
  await loadCurrentView();
}

async function login(event) {
  event.preventDefault();
  const password = $('passwordInput').value;
  try {
    const res = await api('/api/dashboard/login', {
      method: 'POST',
      noAuth: true,
      body: { password }
    });
    // Gespeichert wird nur das Login-Token, nie das Passwort
    state.token = res.token;
    localStorage.setItem('hugoDmDashboardToken', res.token);
    $('passwordInput').value = '';
    $('loginView').classList.add('hidden');
    $('appView').classList.remove('hidden');
    await showView(state.currentView || 'overview');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function boot() {
  try {
    const status = await api('/api/dashboard/status', { noAuth: true });
    $('botName').textContent = status.bot;

    if (!status.configured) {
      $('loginHint').textContent = 'DASHBOARD_PASSWORD ist auf dem Server noch nicht gesetzt.';
      $('loginView').classList.remove('hidden');
      return;
    }

    if (state.token) {
      $('appView').classList.remove('hidden');
      await showView(state.currentView || 'overview');
    } else {
      $('loginView').classList.remove('hidden');
    }
  } catch (error) {
    state.token = '';
    localStorage.removeItem('hugoDmDashboardToken');
    $('appView').classList.add('hidden');
    $('loginHint').textContent = 'Dashboard konnte nicht geladen werden.';
    $('loginView').classList.remove('hidden');
    showToast(error.message, true);
  }
}

$('loginForm').addEventListener('submit', login);
$('overviewRefreshBtn').addEventListener('click', () => loadOverview().catch(error => showToast(error.message, true)));
$('refreshBtn').addEventListener('click', () => refreshDashboard().catch(error => showToast(error.message, true)));
$('ticketsRefreshBtn').addEventListener('click', () => loadTickets().catch(error => showToast(error.message, true)));
$('ticketStateFilter').addEventListener('change', () => {
  state.ticketState = $('ticketStateFilter').value;
  loadTickets().catch(error => showToast(error.message, true));
});
$('ticketTypeFilter').addEventListener('change', () => {
  state.ticketType = $('ticketTypeFilter').value;
  loadTickets().catch(error => showToast(error.message, true));
});
$('ticketOpenBtn').addEventListener('click', openSelectedTicket);
$('ticketCloseBtn').addEventListener('click', () => closeSelectedTicket().catch(error => showToast(error.message, true)));
$('ticketReopenBtn').addEventListener('click', () => reopenSelectedTicket().catch(error => showToast(error.message, true)));
$('ticketTranscriptBtn').addEventListener('click', () => downloadTicketTranscript().catch(error => showToast(error.message, true)));
$('ticketNoteSaveBtn').addEventListener('click', () => saveTicketNote().catch(error => showToast(error.message, true)));
$('ticketSendMessageBtn').addEventListener('click', () => sendTicketMessage().catch(error => showToast(error.message, true)));
$('ticketMessageText').addEventListener('keydown', event => sendOnEnter(event, sendTicketMessage));
$('ordersRefreshBtn').addEventListener('click', () => loadOrders().catch(error => showToast(error.message, true)));
$('orderStatusFilter').addEventListener('change', () => {
  state.orderStatus = $('orderStatusFilter').value;
  loadOrders().catch(error => showToast(error.message, true));
});
$('orderSaveBtn').addEventListener('click', () => saveOrderStatus().catch(error => showToast(error.message, true)));
$('orderAssignBtn').addEventListener('click', () => assignOrder().catch(error => showToast(error.message, true)));
$('orderInvoiceBtn').addEventListener('click', () => sendOrderInvoiceFromDashboard().catch(error => showToast(error.message, true)));
$('orderCompleteBtn').addEventListener('click', () => completeOrder().catch(error => showToast(error.message, true)));
$('orderOpenBtn').addEventListener('click', openSelectedOrder);
$('orderCloseBtn').addEventListener('click', () => closeSelectedOrder().catch(error => showToast(error.message, true)));
$('presenceForm').addEventListener('submit', savePresence);
$('inviteSetForm').addEventListener('submit', saveInviteAmount);
$('invitesRefreshBtn').addEventListener('click', () => loadInvites().catch(error => showToast(error.message, true)));
$('stockCreateForm').addEventListener('submit', event => createStockItem(event).catch(error => showToast(error.message, true)));
$('stockCreateResetBtn').addEventListener('click', resetStockCreateForm);
$('stockNewName').addEventListener('input', syncStockIdSuggestion);
$('stockNewId').addEventListener('input', () => {
  $('stockNewId').dataset.touched = 'true';
  $('stockNewId').value = stockIdFromName($('stockNewId').value);
});
$('stockRefreshBtn').addEventListener('click', () => loadStock().catch(error => showToast(error.message, true)));
$('shopRefreshBtn').addEventListener('click', () => loadShop().catch(error => showToast(error.message, true)));
$('shopPanelForm').addEventListener('submit', event => postShopPanel(event).catch(error => showToast(error.message, true)));
$('saleForm').addEventListener('submit', event => postSale(event).catch(error => showToast(error.message, true)));
$('userLookupForm').addEventListener('submit', lookupUser);
$('replyBtn').addEventListener('click', () => sendReply().catch(error => showToast(error.message, true)));
$('newSendBtn').addEventListener('click', () => sendNewDm().catch(error => showToast(error.message, true)));
$('replyText').addEventListener('keydown', event => sendOnEnter(event, sendReply));
$('newMessage').addEventListener('keydown', event => sendOnEnter(event, sendNewDm));
$('replyFiles').addEventListener('change', () => updateFileList('replyFiles', 'replyFileList'));
$('newFiles').addEventListener('change', () => updateFileList('newFiles', 'newFileList'));
$('archiveBtn').addEventListener('click', toggleArchive);
$('deleteThreadBtn').addEventListener('click', deleteThread);
$('threadSearch').addEventListener('input', () => {
  state.search = $('threadSearch').value.trim();
  clearTimeout(loadThreads.searchTimer);
  loadThreads.searchTimer = setTimeout(() => loadThreads().catch(error => showToast(error.message, true)), 180);
});
document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(item => {
      item.classList.toggle('active', item === button);
    });
    loadThreads().catch(error => showToast(error.message, true));
  });
});
// ── Handy: Menü „Mehr“ und nach Auswahl zum Inhalt springen ──
const phoneQuery = window.matchMedia('(max-width: 760px)');
let lastUserTap = 0;
document.addEventListener('click', () => { lastUserTap = Date.now(); }, true);

function setMobileMenu(open) {
  document.body.classList.toggle('menu-open', open);
  $('mobileMenuBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
}
$('mobileMenuBtn').addEventListener('click', () => setMobileMenu(!document.body.classList.contains('menu-open')));
$('mobileMenuBackdrop').addEventListener('click', () => setMobileMenu(false));
document.querySelectorAll('.topbar .nav [data-view], .mobile-tabs [data-view]').forEach(button => {
  button.addEventListener('click', () => {
    setMobileMenu(false);
    if (phoneQuery.matches) window.scrollTo({ top: 0 });
  });
});

// Nach Tippen auf ein Ticket/eine Bestellung/eine DM direkt zu den Details scrollen
function revealOnPhone(element) {
  if (!phoneQuery.matches || !element || Date.now() - lastUserTap > 1500) return;
  const top = element.getBoundingClientRect().top + window.scrollY - 70;
  window.scrollTo({ top, behavior: 'smooth' });
}

document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => showView(button.dataset.view).catch(error => showToast(error.message, true)));
});
$('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('hugoDmDashboardToken');
  location.reload();
});
$('copyIdBtn').addEventListener('click', () => {
  if (!state.selectedUserId) return;
  navigator.clipboard?.writeText(state.selectedUserId);
  showToast('User-ID kopiert.');
});

setInterval(() => {
  if (!state.token || $('appView').classList.contains('hidden')) return;
  if (shouldPauseAutoRefresh()) return;
  loadCurrentView().catch(() => {});
}, 15000);

boot();
