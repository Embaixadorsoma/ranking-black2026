// Ranking Black Compre Vinho — lê os arquivos da pasta data/ e monta a página.
(async () => {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const int = new Intl.NumberFormat('pt-BR');
  const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
  const $ = (id) => document.getElementById(id);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const ddmm = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
  const get = (f) => fetch('data/' + f + '?v=' + Date.now()).then((r) => r.json());

  let cfg, vendas, produtos, embaixadores, anteriores;
  try {
    [cfg, vendas, produtos, embaixadores, anteriores] = await Promise.all([get('config.json'), get('vendas_dia.json'), get('produtos.json'), get('embaixadores.json'), get('blocos_anteriores.json').catch(() => [])]);
  } catch (e) {
    $('atualizado').textContent = 'Não foi possível carregar os números agora. Tente recarregar a página.';
    return;
  }

  // dias de um bloco
  const diasDe = (b) => {
    const out = [];
    for (let d = new Date(b.inicio + 'T12:00:00Z'); d <= new Date(b.fim + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
    return out;
  };
  // garrafas e valor de cada produto de um bloco, por dia
  const contar = (lista, ds) => {
    const rows = lista.map((p) => {
      const r = { nome: p.nome, cor: p.cor, porDia: Object.fromEntries(ds.map((d) => [d, 0])), total: 0 };
      for (const v of produtos) {
        if (!ds.includes(v.dia) || !v.produto) continue;
        if (p.desde && v.dia < p.desde) continue;
        const n = norm(v.produto);
        if (p.palavras.every((w) => n.includes(w)) && !p.fora.some((w) => n.includes(w))) { r.porDia[v.dia] += Number(v.unidades); r.total += Number(v.unidades); }
      }
      r.valor = Math.round(r.total * p.preco * 100) / 100;
      return r;
    }).sort((a, b) => b.total - a.total || b.valor - a.valor);
    rows.forEach((r, i) => { r.pos = i + 1; });
    return rows;
  };
  // ranking de embaixadores de um bloco
  const rankEmb = (ds) => {
    const m = new Map();
    for (const r of embaixadores) {
      if (!r.embaixador || !ds.includes(r.dia)) continue;
      const a = m.get(r.embaixador) || { nome: r.embaixador, pedidos: 0, total: 0 };
      a.pedidos += Number(r.pedidos); a.total += Number(r.total);
      m.set(r.embaixador, a);
    }
    const out = [...m.values()].sort((a, b) => b.total - a.total);
    out.forEach((r, i) => { r.total = Math.round(r.total * 100) / 100; r.pos = i + 1; });
    return out;
  };
  const dias = diasDe(cfg.bloco);
  const noBloco = (dia) => dias.includes(dia);

  // cabeçalho
  $('bloco-nome').textContent = cfg.bloco.nome;
  const datas = ddmm(cfg.bloco.inicio) + ' a ' + ddmm(cfg.bloco.fim);
  $('bloco-datas').textContent = datas;
  document.querySelectorAll('.bloco-nome-l').forEach((e) => { e.textContent = cfg.bloco.nome; });
  document.querySelectorAll('.bloco-datas-l').forEach((e) => { e.textContent = datas; });
  $('mes-nome').textContent = cfg.mes.nome;
  if (cfg.atualizado) {
    const d = new Date(cfg.atualizado);
    $('atualizado').textContent = 'Atualizado em ' + d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
  }

  // metas
  const meta = (pre, alvo, vendido, rotulo) => {
    $(pre + '-meta').textContent = brl.format(alvo);
    $(pre + '-vendido').textContent = brl.format(vendido);
    const p = alvo > 0 ? vendido / alvo : 0;
    $(pre + '-pct').textContent = pct.format(p);
    $(pre + '-falta').textContent = brl.format(Math.max(0, alvo - vendido));
    const bar = $(pre + '-bar');
    requestAnimationFrame(() => { bar.style.width = (Math.min(1, p) * 100).toFixed(1) + '%'; });
    const batida = vendido >= alvo;
    bar.classList.toggle('bk-ok', batida);
    $(pre + '-falta-wrap').hidden = batida;
    $(pre + '-batida').hidden = !batida;
  };
  const soma = (rows) => Math.round(rows.reduce((s, r) => s + Number(r.valor || 0), 0) * 100) / 100;
  meta('mes', cfg.mes.meta, soma(vendas.filter((r) => String(r.dia).startsWith(cfg.mes.prefixo))));
  meta('bl', cfg.bloco.meta, soma(vendas.filter((r) => noBloco(r.dia))));

  // produtos do bloco
  const linhas = contar(cfg.produtos, dias);

  const totUnid = linhas.reduce((s, r) => s + r.total, 0);
  $('t-unid').textContent = int.format(totUnid);
  $('t-lider').textContent = linhas[0] && linhas[0].total > 0 ? linhas[0].nome : '—';
  $('t-valor').textContent = brl.format(linhas.reduce((s, r) => s + r.valor, 0));

  $('legenda').replaceChildren(...cfg.marcas.map(([nome, cor]) => { const s = mk('span'); const d = mk('i', 'bk-dot'); d.style.background = cor; s.append(d, document.createTextNode(nome)); return s; }));

  const head = $('prod-head');
  head.replaceChildren(mk('th', '', '#'), mk('th', 'bk-prod', 'Produto'), ...dias.map((d) => mk('th', 'bk-c', ddmm(d))), mk('th', 'bk-r', 'Total do período'), mk('th', 'bk-r', 'Valor do período'));

  const rank = (pos, ativo) => mk('span', 'bk-rank' + (ativo && pos <= 3 ? ' r' + pos : ''), String(pos));
  const maxDia = Math.max(1, ...linhas.flatMap((r) => dias.map((d) => r.porDia[d])));
  const maxTot = Math.max(1, ...linhas.map((r) => r.total));
  $('prod-body').replaceChildren(...linhas.map((r) => {
    const ativo = r.total > 0;
    const tr = mk('tr', ativo && r.pos === 1 ? 'bk-gold' : '');
    const t0 = mk('td'); t0.append(rank(r.pos, ativo)); tr.append(t0);
    const t1 = mk('td'); const nm = mk('span', 'bk-pname'); const dot = mk('i', 'bk-dot'); dot.style.background = r.cor; nm.append(dot, document.createTextNode(r.nome));
    const sh = mk('div', 'bk-share'); const fi = mk('i'); fi.style.width = (r.total / maxTot * 100).toFixed(1) + '%'; sh.append(fi); t1.append(nm, sh); tr.append(t1);
    dias.forEach((d) => {
      const v = r.porDia[d];
      const td = mk('td', 'bk-c bk-day' + (v === 0 ? ' bk-zero' : ''), int.format(v));
      if (v > 0) { td.style.background = `rgba(194, 58, 104, ${(0.18 + 0.62 * v / maxDia).toFixed(2)})`; td.style.color = '#fff'; td.style.fontWeight = '700'; }
      tr.append(td);
    });
    tr.append(mk('td', 'bk-r bk-tot' + (r.total === 0 ? ' bk-zero' : ''), int.format(r.total)));
    tr.append(mk('td', 'bk-r bk-val' + (r.valor === 0 ? ' bk-zero' : ''), brl.format(r.valor)));
    return tr;
  }));

  // embaixadores
  const emb = rankEmb(dias);
  $('e-total').textContent = brl.format(emb.reduce((s, r) => s + r.total, 0));
  $('e-pedidos').textContent = int.format(emb.reduce((s, r) => s + r.pedidos, 0));
  $('e-qtd').textContent = int.format(emb.length);
  const medalhas = ['🥇', '🥈', '🥉'];
  $('podio').replaceChildren(...emb.slice(0, 3).map((r, i) => {
    const c = mk('div', 'bk-pod p' + (i + 1));
    c.append(mk('span', 'bk-medal', medalhas[i]), mk('span', 'bk-pod-name', r.nome), mk('span', 'bk-pod-val', brl.format(r.total)), mk('span', 'bk-pod-sub', int.format(r.pedidos) + (r.pedidos === 1 ? ' pedido' : ' pedidos')));
    return c;
  }));
  $('podio-vazio').hidden = emb.length > 0;
  $('emb-body').replaceChildren(...emb.map((r) => {
    const tr = mk('tr', r.pos === 1 ? 'bk-gold' : '');
    const t0 = mk('td'); t0.append(rank(r.pos, true)); tr.append(t0);
    tr.append(mk('td', '', r.nome), mk('td', 'bk-r', int.format(r.pedidos)), mk('td', 'bk-r bk-val', brl.format(r.total)));
    return tr;
  }));

  // blocos anteriores (resumo)
  const ant = Array.isArray(anteriores) ? anteriores : [];
  $('tab-anteriores').hidden = ant.length === 0;
  $('anteriores').replaceChildren(...ant.slice().reverse().map((b) => {
    const ds = diasDe(b);
    const vendido = soma(vendas.filter((r) => ds.includes(r.dia)));
    const p = b.meta > 0 ? vendido / b.meta : 0;
    const batida = vendido >= b.meta;
    const prods = contar(b.produtos, ds);
    const embs = rankEmb(ds);
    const card = mk('div', 'bk-card bk-ant');

    const head = mk('div', 'bk-ant-head');
    head.append(mk('h2', '', b.nome + ' · ' + ddmm(b.inicio) + ' a ' + ddmm(b.fim)), mk('span', 'bk-ant-tag' + (batida ? ' bk-ok-tag' : ''), batida ? '🎉 Meta batida' : pct.format(p) + ' da meta'));
    card.append(head);

    const linha = mk('p', 'bk-meta-line bk-note');
    const item = (rot, val) => { const s = mk('span'); s.append(document.createTextNode(rot + ': ')); s.append(mk('b', '', val)); return s; };
    linha.append(item('Meta', brl.format(b.meta)), item('Vendido (todos os produtos)', brl.format(vendido)), batida ? mk('span', 'bk-batida', 'Passou ' + brl.format(vendido - b.meta) + ' da meta') : item('Faltou', brl.format(Math.max(0, b.meta - vendido))));
    const track = mk('div', 'bk-track bk-track-sm'); const fill = mk('div', 'bk-fill bk-fill-mes' + (batida ? ' bk-ok' : '')); track.append(fill);
    requestAnimationFrame(() => { fill.style.width = (Math.min(1, p) * 100).toFixed(1) + '%'; });
    card.append(track, linha);

    const tiles = mk('div', 'bk-tiles');
    const tile = (ico, rot, val) => { const t = mk('div', 'bk-tile'); const h = mk('p', 'bk-tile-head'); h.append(mk('span', 'bk-ico', ico), document.createTextNode(rot)); t.append(h, mk('p', 'bk-num', val)); return t; };
    tiles.append(
      tile('📦', 'Garrafas dos produtos do bloco', int.format(prods.reduce((s, r) => s + r.total, 0))),
      tile('💰', 'Valor dos produtos do bloco', brl.format(prods.reduce((s, r) => s + r.valor, 0))),
      tile('🧾', 'Pedidos com embaixador', int.format(embs.reduce((s, r) => s + r.pedidos, 0))),
    );
    card.append(tiles);

    const cols = mk('div', 'bk-ant-cols');
    const tabela = (titulo, cab, rows) => {
      const box = mk('div'); box.append(mk('h3', '', titulo));
      const wrap = mk('div', 'bk-wrap'); const t = mk('table', 'bk-table');
      const th = mk('tr'); cab.forEach(([txt, cls]) => th.append(mk('th', cls, txt)));
      const thead = mk('thead'); thead.append(th); const tb = mk('tbody'); tb.append(...rows);
      t.append(thead, tb); wrap.append(t); box.append(wrap); return box;
    };
    const top = prods.filter((r) => r.total > 0).slice(0, 5);
    cols.append(tabela('Produtos que mais venderam', [['#', ''], ['Produto', 'bk-prod'], ['Garrafas', 'bk-r'], ['Valor', 'bk-r']], top.length ? top.map((r) => {
      const tr = mk('tr', r.pos === 1 ? 'bk-gold' : '');
      const t0 = mk('td'); t0.append(rank(r.pos, true));
      const t1 = mk('td'); const nm = mk('span', 'bk-pname'); const dot = mk('i', 'bk-dot'); dot.style.background = r.cor; nm.append(dot, document.createTextNode(r.nome)); t1.append(nm);
      tr.append(t0, t1, mk('td', 'bk-r bk-tot', int.format(r.total)), mk('td', 'bk-r bk-val', brl.format(r.valor)));
      return tr;
    }) : [(() => { const tr = mk('tr'); const td = mk('td', 'bk-zero', 'Nenhuma venda dos produtos do bloco.'); td.colSpan = 4; tr.append(td); return tr; })()]));
    const topE = embs.slice(0, 5);
    cols.append(tabela('Embaixadores que mais venderam', [['#', ''], ['Embaixador', 'bk-prod'], ['Pedidos', 'bk-r'], ['Total', 'bk-r']], topE.length ? topE.map((r) => {
      const tr = mk('tr', r.pos === 1 ? 'bk-gold' : '');
      const t0 = mk('td'); t0.append(rank(r.pos, true));
      tr.append(t0, mk('td', '', r.nome), mk('td', 'bk-r', int.format(r.pedidos)), mk('td', 'bk-r bk-val', brl.format(r.total)));
      return tr;
    }) : [(() => { const tr = mk('tr'); const td = mk('td', 'bk-zero', 'Nenhuma venda de embaixador.'); td.colSpan = 4; tr.append(td); return tr; })()]));
    card.append(cols);
    return card;
  }));

  // abas
  const show = (page) => {
    document.querySelectorAll('.bk-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.page === page)));
    document.querySelectorAll('.bk-page').forEach((s) => { s.hidden = s.id !== page; });
  };
  document.querySelectorAll('.bk-tab').forEach((t) => t.addEventListener('click', () => { show(t.dataset.page); history.replaceState(null, '', '#' + t.dataset.page); }));
  if (location.hash === '#embaixadores') show('embaixadores');
  if (location.hash === '#anteriores' && ant.length) show('anteriores');
})();
