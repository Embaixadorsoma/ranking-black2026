// Ranking Black Compre Vinho — lê os arquivos da pasta data/ e monta a página.
// Cada bloco (os que já acabaram, em data/blocos_anteriores.json, e o que vale, em data/config.json)
// ganha a sua própria aba com metas e produtos por dia; a aba Embaixadores tem um seletor de bloco.
(async () => {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const int = new Intl.NumberFormat('pt-BR');
  const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
  const $ = (id) => document.getElementById(id);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const ddmm = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
  const get = (f) => fetch('data/' + f + '?v=' + Date.now()).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });

  let cfg, vendas, produtos, embaixadores, anteriores;
  try {
    [cfg, vendas, produtos, embaixadores, anteriores] = await Promise.all([get('config.json'), get('vendas_dia.json'), get('produtos.json'), get('embaixadores.json'), get('blocos_anteriores.json').catch(() => [])]);
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

  const blocos = [...(Array.isArray(anteriores) ? anteriores : []), { ...cfg.bloco, produtos: cfg.produtos, marcas: cfg.marcas }]
    .map((b, i) => ({ ...b, id: 'bloco' + (i + 1), dias: diasDe(b) }));

  // cabeçalho
  $('sub').replaceChildren(...blocos.flatMap((b) => [mk('span', 'bk-chip', b.nome), document.createTextNode(ddmm(b.inicio) + ' a ' + ddmm(b.fim) + ' · ')]), document.createTextNode('todas as lojas · só pedidos aprovados'));
  if (cfg.atualizado) {
    const d = new Date(cfg.atualizado);
    $('atualizado').textContent = 'Atualizado em ' + d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
  }

  // garrafas e valor de cada produto de um bloco, por dia
  const contar = (b) => {
    const rows = b.produtos.map((p) => {
      const r = { nome: p.nome, cor: p.cor, porDia: Object.fromEntries(b.dias.map((d) => [d, 0])), total: 0 };
      for (const v of produtos) {
        if (!b.dias.includes(v.dia) || !v.produto) continue;
        if (p.desde && v.dia < p.desde) continue;
        const n = norm(v.produto);
        if (p.palavras.every((w) => n.includes(w)) && !p.fora.some((w) => n.includes(w))) { r.porDia[v.dia] += Number(v.unidades); r.total += Number(v.unidades); }
      }
      r.valor = Math.round(r.total * p.preco * 100) / 100;
      return r;
    }).sort((a, z) => z.total - a.total || z.valor - a.valor);
    rows.forEach((r, i) => { r.pos = i + 1; });
    return rows;
  };
  // ranking de embaixadores de um bloco
  const rankEmb = (b) => {
    const m = new Map();
    for (const r of embaixadores) {
      if (!r.embaixador || !b.dias.includes(r.dia)) continue;
      const a = m.get(r.embaixador) || { nome: r.embaixador, pedidos: 0, total: 0 };
      a.pedidos += Number(r.pedidos); a.total += Number(r.total);
      m.set(r.embaixador, a);
    }
    const out = [...m.values()].sort((a, z) => z.total - a.total);
    out.forEach((r, i) => { r.total = Math.round(r.total * 100) / 100; r.pos = i + 1; });
    return out;
  };

  // uma página por bloco
  const tpl = $('tpl-bloco');
  for (const b of blocos) {
    const sec = tpl.content.firstElementChild.cloneNode(true);
    sec.id = b.id;
    const q = (k) => sec.querySelector('[data-k="' + k + '"]');
    q('nome').textContent = b.nome; q('nome2').textContent = b.nome;
    q('datas').textContent = ddmm(b.inicio) + ' a ' + ddmm(b.fim);
    q('mes-nome').textContent = cfg.mes.nome;

    const meta = (pre, alvo, vendido) => {
      q(pre + '-meta').textContent = brl.format(alvo);
      q(pre + '-vendido').textContent = brl.format(vendido);
      const p = alvo > 0 ? vendido / alvo : 0;
      q(pre + '-pct').textContent = pct.format(p);
      q(pre + '-falta').textContent = brl.format(Math.max(0, alvo - vendido));
      const bar = q(pre + '-bar');
      requestAnimationFrame(() => { bar.style.width = (Math.min(1, p) * 100).toFixed(1) + '%'; });
      const batida = vendido >= alvo;
      bar.classList.toggle('bk-ok', batida);
      q(pre + '-falta-wrap').hidden = batida;
      q(pre + '-batida').hidden = !batida;
    };
    meta('mes', cfg.mes.meta, soma(vendas.filter((r) => String(r.dia).startsWith(cfg.mes.prefixo))));
    meta('bl', b.meta, soma(vendas.filter((r) => b.dias.includes(r.dia))));

    const linhas = contar(b);
    q('t-unid').textContent = int.format(linhas.reduce((s, r) => s + r.total, 0));
    q('t-lider').textContent = linhas[0] && linhas[0].total > 0 ? linhas[0].nome : '—';
    q('t-valor').textContent = brl.format(linhas.reduce((s, r) => s + r.valor, 0));
    q('legenda').replaceChildren(...(b.marcas || []).map(([nome, cor]) => { const s = mk('span'); const d = mk('i', 'bk-dot'); d.style.background = cor; s.append(d, document.createTextNode(nome)); return s; }));
    q('prod-head').replaceChildren(mk('th', '', '#'), mk('th', 'bk-prod', 'Produto'), ...b.dias.map((d) => mk('th', 'bk-c', ddmm(d))), mk('th', 'bk-r', 'Total do período'), mk('th', 'bk-r', 'Valor do período'));
    const maxDia = Math.max(1, ...linhas.flatMap((r) => b.dias.map((d) => r.porDia[d])));
    const maxTot = Math.max(1, ...linhas.map((r) => r.total));
    q('prod-body').replaceChildren(...linhas.map((r) => {
      const ativo = r.total > 0;
      const tr = mk('tr', ativo && r.pos === 1 ? 'bk-gold' : '');
      const t0 = mk('td'); t0.append(rank(r.pos, ativo)); tr.append(t0);
      const t1 = mk('td'); const nm = mk('span', 'bk-pname'); const dot = mk('i', 'bk-dot'); dot.style.background = r.cor; nm.append(dot, document.createTextNode(r.nome));
      const sh = mk('div', 'bk-share'); const fi = mk('i'); fi.style.width = (r.total / maxTot * 100).toFixed(1) + '%'; sh.append(fi); t1.append(nm, sh); tr.append(t1);
      b.dias.forEach((d) => {
        const v = r.porDia[d];
        const td = mk('td', 'bk-c bk-day' + (v === 0 ? ' bk-zero' : ''), int.format(v));
        if (v > 0) { td.style.background = `rgba(194, 58, 104, ${(0.18 + 0.62 * v / maxDia).toFixed(2)})`; td.style.color = '#fff'; td.style.fontWeight = '700'; }
        tr.append(td);
      });
      tr.append(mk('td', 'bk-r bk-tot' + (r.total === 0 ? ' bk-zero' : ''), int.format(r.total)));
      tr.append(mk('td', 'bk-r bk-val' + (r.valor === 0 ? ' bk-zero' : ''), brl.format(r.valor)));
      return tr;
    }));
    $('paginas').append(sec);
  }

  // embaixadores, por bloco
  const medalhas = ['🥇', '🥈', '🥉'];
  const mostrarEmb = (b) => {
    document.querySelectorAll('.bk-subtab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.bloco === b.id)));
    const emb = rankEmb(b);
    $('e-nome').textContent = b.nome;
    $('e-nota').textContent = 'Soma de ' + ddmm(b.inicio) + ' a ' + ddmm(b.fim) + ', do maior valor vendido para o menor.';
    $('e-total').textContent = brl.format(emb.reduce((s, r) => s + r.total, 0));
    $('e-pedidos').textContent = int.format(emb.reduce((s, r) => s + r.pedidos, 0));
    $('e-qtd').textContent = int.format(emb.length);
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
  };
  $('emb-abas').replaceChildren(...blocos.map((b) => {
    const t = mk('button', 'bk-subtab', b.nome + ' · ' + ddmm(b.inicio) + ' a ' + ddmm(b.fim));
    t.setAttribute('role', 'tab'); t.dataset.bloco = b.id;
    t.addEventListener('click', () => mostrarEmb(b));
    return t;
  }));

  // o bloco que está valendo hoje abre primeiro (num dia que é de dois blocos, vale o que começou antes)
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const atual = blocos.find((b) => b.dias.includes(hoje)) || blocos[blocos.length - 1];
  mostrarEmb(atual);

  // abas
  $('abas').replaceChildren(...[...blocos.map((b) => [b.id, '🍷 ' + b.nome]), ['embaixadores', '🏆 Embaixadores']].map(([id, txt]) => {
    const t = mk('button', 'bk-tab', txt); t.setAttribute('role', 'tab'); t.dataset.page = id; return t;
  }));
  const show = (page) => {
    document.querySelectorAll('.bk-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.page === page)));
    document.querySelectorAll('.bk-page').forEach((s) => { s.hidden = s.id !== page; });
  };
  document.querySelectorAll('.bk-tab').forEach((t) => t.addEventListener('click', () => { show(t.dataset.page); history.replaceState(null, '', '#' + t.dataset.page); }));
  const hash = location.hash.slice(1);
  show(document.getElementById(hash) && (hash === 'embaixadores' || blocos.some((b) => b.id === hash)) ? hash : atual.id);
})();
