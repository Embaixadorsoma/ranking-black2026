// Ranking Black Compre Vinho — lê os arquivos da pasta data/ e monta a página.
// Duas abas: "Ranking do mês" (10 vinhos da Black mais vendidos e 10 embaixadores que mais venderam
// de 01/11 a 30/11) e "Black 11/11" (vinhos que valem só no dia 11/11 e embaixadores do dia).
(async () => {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const int = new Intl.NumberFormat('pt-BR');
  const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
  const $ = (id) => document.getElementById(id);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const ddmm = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
  const get = (f) => fetch('data/' + f + '?v=' + Date.now()).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });

  let cfg, vendas, produtos, embaixadores;
  try {
    [cfg, vendas, produtos, embaixadores] = await Promise.all([get('config.json'), get('vendas_dia.json'), get('produtos.json'), get('embaixadores.json')]);
  } catch (e) {
    $('atualizado').textContent = 'Não foi possível carregar os números agora. Tente recarregar a página.';
    return;
  }

  const diasDe = (b) => {
    const out = [];
    for (let d = new Date(b.inicio + 'T12:00:00Z'); d <= new Date(b.fim + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
    return out;
  };
  const soma = (rows) => Math.round(rows.reduce((s, r) => s + Number(r.valor || 0), 0) * 100) / 100;
  const rank = (pos, ativo) => mk('span', 'bk-rank' + (ativo && pos <= 3 ? ' r' + pos : ''), String(pos));
  const TOP = (cfg.ranking && cfg.ranking.top) || 10;
  const medalhas = ['🥇', '🥈', '🥉'];

  if (cfg.atualizado) {
    const d = new Date(cfg.atualizado);
    $('atualizado').textContent = 'Atualizado em ' + d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
  }

  // garrafas e valor de cada vinho no período
  // (cada vinho conta a partir de "desde" e não conta nos dias de "fora_dias")
  const contar = (lista, dias) => {
    const rows = lista.map((p) => {
      const r = { nome: p.nome, cor: p.cor, total: 0 };
      for (const v of produtos) {
        if (!dias.includes(v.dia) || !v.produto) continue;
        if (p.desde && v.dia < p.desde) continue;
        if (p.fora_dias && p.fora_dias.includes(v.dia)) continue;
        const n = norm(v.produto);
        if (p.palavras.every((w) => n.includes(w)) && !p.fora.some((w) => n.includes(w))) r.total += Number(v.unidades);
      }
      r.valor = Math.round(r.total * p.preco * 100) / 100;
      return r;
    }).sort((a, z) => z.total - a.total || z.valor - a.valor);
    rows.forEach((r, i) => { r.pos = i + 1; });
    return rows;
  };
  const rankEmb = (dias) => {
    const m = new Map();
    for (const r of embaixadores) {
      if (!r.embaixador || !dias.includes(r.dia)) continue;
      const a = m.get(r.embaixador) || { nome: r.embaixador, pedidos: 0, total: 0 };
      a.pedidos += Number(r.pedidos); a.total += Number(r.total);
      m.set(r.embaixador, a);
    }
    const out = [...m.values()].sort((a, z) => z.total - a.total);
    out.forEach((r, i) => { r.total = Math.round(r.total * 100) / 100; r.pos = i + 1; });
    return out;
  };
  const podio = (el, rows, nome, val, sub) => {
    el.replaceChildren(...rows.slice(0, 3).map((r, i) => {
      const c = mk('div', 'bk-pod p' + (i + 1));
      c.append(mk('span', 'bk-medal', medalhas[i]), mk('span', 'bk-pod-name', nome(r)), mk('span', 'bk-pod-val', val(r)), mk('span', 'bk-pod-sub', sub(r)));
      return c;
    }));
  };

  const paginas = [
    { id: 'mes', aba: '🍷 ' + (cfg.ranking.nome || 'Ranking do mês'), b: cfg.ranking, lista: cfg.produtos, mes: true },
    { id: 'd11', aba: '🍷 ' + cfg.black_11_11.nome, b: cfg.black_11_11, lista: cfg.black_11_11.produtos, mes: false },
  ];

  $('sub').replaceChildren(
    mk('span', 'bk-chip', paginas[0].b.nome), document.createTextNode(ddmm(paginas[0].b.inicio) + ' a ' + ddmm(paginas[0].b.fim) + ' · '),
    mk('span', 'bk-chip', paginas[1].b.nome), document.createTextNode('só ' + ddmm(paginas[1].b.inicio) + ' · '),
    document.createTextNode('todas as lojas · só pedidos aprovados'));

  const tpl = $('tpl-pagina');
  for (const pg of paginas) {
    const dias = diasDe(pg.b);
    const sec = tpl.content.firstElementChild.cloneNode(true);
    sec.id = pg.id;
    const q = (k) => sec.querySelector('[data-k="' + k + '"]');

    // meta do mês
    q('mes-nome').textContent = cfg.mes.nome;
    const vendidoMes = soma(vendas.filter((r) => String(r.dia).startsWith(cfg.mes.prefixo)));
    const p = cfg.mes.meta > 0 ? vendidoMes / cfg.mes.meta : 0;
    q('mes-meta').textContent = brl.format(cfg.mes.meta);
    q('mes-vendido').textContent = brl.format(vendidoMes);
    q('mes-pct').textContent = pct.format(p);
    q('mes-falta').textContent = brl.format(Math.max(0, cfg.mes.meta - vendidoMes));
    const bar = q('mes-bar');
    requestAnimationFrame(() => { bar.style.width = (Math.min(1, p) * 100).toFixed(1) + '%'; });
    bar.classList.toggle('bk-ok', vendidoMes >= cfg.mes.meta);
    q('mes-falta-wrap').hidden = vendidoMes >= cfg.mes.meta;
    q('mes-batida').hidden = vendidoMes < cfg.mes.meta;
    if (pg.mes) q('dia-wrap').hidden = true;
    else q('dia-vendido').textContent = brl.format(soma(vendas.filter((r) => dias.includes(r.dia))));

    // vinhos
    const linhas = contar(pg.lista, dias);
    const quando = pg.mes ? 'no mês' : 'no dia';
    q('t-unid-lbl').textContent = 'Garrafas dos vinhos da Black ' + quando;
    q('t-valor-lbl').textContent = 'Valor dos vinhos da Black ' + quando;
    q('t-unid').textContent = int.format(linhas.reduce((s, r) => s + r.total, 0));
    q('t-lider').textContent = linhas[0] && linhas[0].total > 0 ? linhas[0].nome : '—';
    q('t-valor').textContent = brl.format(linhas.reduce((s, r) => s + r.valor, 0));
    const vendidos = linhas.filter((r) => r.total > 0);
    q('pv-titulo').textContent = 'Pódio dos vinhos ' + (pg.mes ? 'do mês' : 'do dia ' + ddmm(pg.b.inicio));
    podio(q('podio-vinhos'), vendidos, (r) => r.nome, (r) => int.format(r.total) + (r.total === 1 ? ' garrafa' : ' garrafas'), (r) => brl.format(r.valor));
    q('podio-vinhos-vazio').hidden = vendidos.length > 0;
    q('prod-titulo').textContent = 'Os ' + TOP + ' vinhos mais vendidos ' + (pg.mes ? 'no mês' : 'no dia ' + ddmm(pg.b.inicio));
    q('prod-nota').textContent = pg.mes
      ? 'Só os vinhos da Black (categoria Black November), de ' + ddmm(pg.b.inicio) + ' a ' + ddmm(pg.b.fim) + ', contando cada vinho a partir do dia em que entrou na Black. Garrafas vendidas e valor (garrafas × preço de Black).'
      : 'Vinhos que valem só no dia ' + ddmm(pg.b.inicio) + '. Garrafas vendidas e valor (garrafas × preço de Black do dia).';
    if (pg.b.marcas) q('legenda').replaceChildren(...pg.b.marcas.map(([nome, cor]) => { const s = mk('span'); const d = mk('i', 'bk-dot'); d.style.background = cor; s.append(d, document.createTextNode(nome)); return s; }));
    else q('legenda').hidden = true;
    const top = linhas.slice(0, TOP);
    const maxTot = Math.max(1, ...top.map((r) => r.total));
    q('prod-body').replaceChildren(...top.map((r) => {
      const ativo = r.total > 0;
      const tr = mk('tr', ativo && r.pos === 1 ? 'bk-gold' : '');
      const t0 = mk('td'); t0.append(rank(r.pos, ativo)); tr.append(t0);
      const t1 = mk('td'); const nm = mk('span', 'bk-pname'); const dot = mk('i', 'bk-dot'); dot.style.background = r.cor; nm.append(dot, document.createTextNode(r.nome));
      const sh = mk('div', 'bk-share'); const fi = mk('i'); fi.style.width = (r.total / maxTot * 100).toFixed(1) + '%'; sh.append(fi); t1.append(nm, sh); tr.append(t1);
      tr.append(mk('td', 'bk-r bk-tot' + (r.total === 0 ? ' bk-zero' : ''), int.format(r.total)));
      tr.append(mk('td', 'bk-r bk-val' + (r.valor === 0 ? ' bk-zero' : ''), brl.format(r.valor)));
      return tr;
    }));

    // embaixadores
    const emb = rankEmb(dias);
    q('e-total').textContent = brl.format(emb.reduce((s, r) => s + r.total, 0));
    q('e-pedidos').textContent = int.format(emb.reduce((s, r) => s + r.pedidos, 0));
    q('e-qtd').textContent = int.format(emb.length);
    q('pe-titulo').textContent = 'Pódio dos embaixadores ' + (pg.mes ? 'do mês' : 'do dia ' + ddmm(pg.b.inicio));
    podio(q('podio'), emb, (r) => r.nome, (r) => brl.format(r.total), (r) => int.format(r.pedidos) + (r.pedidos === 1 ? ' pedido' : ' pedidos'));
    q('podio-vazio').hidden = emb.length > 0;
    q('emb-titulo').textContent = 'Os ' + TOP + ' embaixadores que mais venderam ' + (pg.mes ? 'no mês' : 'no dia ' + ddmm(pg.b.inicio));
    q('emb-nota').textContent = (pg.mes ? 'Soma de ' + ddmm(pg.b.inicio) + ' a ' + ddmm(pg.b.fim) : 'Soma do dia ' + ddmm(pg.b.inicio)) + ' (todos os produtos), do maior valor vendido para o menor.';
    q('emb-body').replaceChildren(...emb.slice(0, TOP).map((r) => {
      const tr = mk('tr', r.pos === 1 ? 'bk-gold' : '');
      const t0 = mk('td'); t0.append(rank(r.pos, true)); tr.append(t0);
      tr.append(mk('td', '', r.nome), mk('td', 'bk-r', int.format(r.pedidos)), mk('td', 'bk-r bk-val', brl.format(r.total)));
      return tr;
    }));
    $('paginas').append(sec);
  }

  // abas: no dia 11/11 abre na Black 11/11; nos outros dias, no ranking do mês
  $('abas').replaceChildren(...paginas.map((pg) => {
    const t = mk('button', 'bk-tab', pg.aba); t.setAttribute('role', 'tab'); t.dataset.page = pg.id; return t;
  }));
  const show = (page) => {
    document.querySelectorAll('.bk-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.page === page)));
    document.querySelectorAll('.bk-page').forEach((s) => { s.hidden = s.id !== page; });
  };
  document.querySelectorAll('.bk-tab').forEach((t) => t.addEventListener('click', () => { show(t.dataset.page); history.replaceState(null, '', '#' + t.dataset.page); }));
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const hash = location.hash.slice(1);
  show(paginas.some((pg) => pg.id === hash) ? hash : (hoje === cfg.black_11_11.inicio ? 'd11' : 'mes'));
})();
