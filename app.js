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

  let cfg, vendas, produtos, embaixadores;
  try {
    [cfg, vendas, produtos, embaixadores] = await Promise.all([get('config.json'), get('vendas_dia.json'), get('produtos.json'), get('embaixadores.json')]);
  } catch (e) {
    $('atualizado').textContent = 'Não foi possível carregar os números agora. Tente recarregar a página.';
    return;
  }

  // dias do bloco
  const dias = [];
  for (let d = new Date(cfg.bloco.inicio + 'T12:00:00Z'); d <= new Date(cfg.bloco.fim + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) dias.push(d.toISOString().slice(0, 10));
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
  const linhas = cfg.produtos.map((p) => {
    const r = { nome: p.nome, cor: p.cor, porDia: Object.fromEntries(dias.map((d) => [d, 0])), total: 0 };
    for (const v of produtos) {
      if (!noBloco(v.dia) || !v.produto) continue;
      if (p.desde && v.dia < p.desde) continue;
      const n = norm(v.produto);
      if (p.palavras.every((w) => n.includes(w)) && !p.fora.some((w) => n.includes(w))) { r.porDia[v.dia] += Number(v.unidades); r.total += Number(v.unidades); }
    }
    r.valor = Math.round(r.total * p.preco * 100) / 100;
    return r;
  }).sort((a, b) => b.total - a.total);
  linhas.forEach((r, i) => { r.pos = i + 1; });

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
  const m = new Map();
  for (const r of embaixadores) {
    if (!r.embaixador || !noBloco(r.dia)) continue;
    const a = m.get(r.embaixador) || { nome: r.embaixador, pedidos: 0, total: 0 };
    a.pedidos += Number(r.pedidos); a.total += Number(r.total);
    m.set(r.embaixador, a);
  }
  const emb = [...m.values()].sort((a, b) => b.total - a.total);
  emb.forEach((r, i) => { r.pos = i + 1; });
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

  // abas
  const show = (page) => {
    document.querySelectorAll('.bk-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.page === page)));
    document.querySelectorAll('.bk-page').forEach((s) => { s.hidden = s.id !== page; });
  };
  document.querySelectorAll('.bk-tab').forEach((t) => t.addEventListener('click', () => { show(t.dataset.page); history.replaceState(null, '', '#' + t.dataset.page); }));
  if (location.hash === '#embaixadores') show('embaixadores');
})();
