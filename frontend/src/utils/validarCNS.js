export function somenteDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

export function validarCNS(valor) {
  const cns = somenteDigitos(valor);
  if (cns.length !== 15) return false;
  const inicio = cns[0];

  if (inicio === '1' || inicio === '2') {
    const pis = cns.substring(0, 11);
    let soma = 0;
    for (let i = 0; i < 11; i++) {
      soma += parseInt(pis[i], 10) * (15 - i);
    }
    let resto = soma % 11;
    let dv = 11 - resto;
    if (dv === 11) dv = 0;

    let resultado;
    if (dv === 10) {
      soma += 2;
      resto = soma % 11;
      dv = 11 - resto;
      resultado = `${pis}001${dv}`;
    } else {
      resultado = `${pis}000${dv}`;
    }
    return resultado === cns;
  }

  if (inicio === '7' || inicio === '8' || inicio === '9') {
    let soma = 0;
    for (let i = 0; i < 15; i++) {
      soma += parseInt(cns[i], 10) * (15 - i);
    }
    return soma % 11 === 0;
  }

  return false;
}

export function classificarCNS(valor) {
  const cns = somenteDigitos(valor);
  if (!cns) return 'Não informado';
  if (cns[0] === '1' || cns[0] === '2') return 'Definitivo';
  if (cns[0] === '7' || cns[0] === '8' || cns[0] === '9') return 'Provisório';
  return 'Formato inválido';
}

export function formatarCNS(valor) {
  const d = somenteDigitos(valor).slice(0, 15);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)} ${d.slice(3)}`;
  if (d.length <= 11) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7, 11)} ${d.slice(11)}`;
}

export function gerarCNSValido() {
  const prefixo = Math.random() > 0.5 ? '7' : '8';
  let base14 = prefixo;
  for (let i = 0; i < 13; i++) {
    base14 += Math.floor(Math.random() * 10);
  }
  for (let d = 0; d <= 9; d++) {
    const candidato = base14 + String(d);
    if (validarCNS(candidato)) return candidato;
  }
  return '700000000000005';
}
export function validarCPF(valor) {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf[9], 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(cpf[10], 10);
}

export function formatarCPF(valor) {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function gerarCPFValido() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  let s1 = 0;
  for (let i = 0; i < 9; i++) s1 += n[i] * (10 - i);
  const d1 = (s1 * 10) % 11 === 10 ? 0 : (s1 * 10) % 11;
  n.push(d1);
  let s2 = 0;
  for (let i = 0; i < 10; i++) s2 += n[i] * (11 - i);
  const d2 = (s2 * 10) % 11 === 10 ? 0 : (s2 * 10) % 11;
  n.push(d2);
  return n.join('');
}