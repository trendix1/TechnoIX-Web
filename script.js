/* script.js - Chatbot logic updated with clean data output, typo & word-number detection */
// == ORIGINAL CODE PRESERVED EXCEPT CHANGES REQUESTED ==

// [The unchanged parts before normalizeNumberText remain the same]

function normalizeNumberText(txt){
  if(!txt) return null;
  txt = txt.toString().toLowerCase().trim();
  // Koreksi typo ringan
  const typoFix = {
    'penghasian':'penghasilan','penhasilan':'penghasilan','pengeluran':'pengeluaran',
    'tabugan':'tabungan','taubungan':'tabungan','uangn':'uang','taungan':'tabungan'
  };
  for (const [wrong,right] of Object.entries(typoFix)) {
    txt = txt.replace(new RegExp(wrong,'g'), right);
  }
  // Konversi kata angka ke numerik sederhana
  const words = {'nol':0,'satu':1,'dua':2,'tiga':3,'empat':4,'lima':5,'enam':6,'tujuh':7,'delapan':8,'sembilan':9,'sepuluh':10,'sebelas':11,'dua belas':12,'tiga belas':13,'empat belas':14,'lima belas':15,'dua puluh':20,'tiga puluh':30,'empat puluh':40,'lima puluh':50,'enam puluh':60,'tujuh puluh':70,'delapan puluh':80,'sembilan puluh':90};
  for (const [k,v] of Object.entries(words)) txt = txt.replace(new RegExp('\\b'+k+'\\b','g'), v.toString());

  txt = txt.replace(/[^0-9a-z.,\s]/g,' ');
  txt = txt.replace(/\b(rp|idr|rupiah)\b/g,'');
  txt = txt.replace(/\b(ribu|rb)\b/g,'000');
  txt = txt.replace(/\bjuta\b/g,'000000');
  txt = txt.replace(/\bmiliar\b/g,'000000000');
  txt = txt.replace(/\s+/g,'').replace(/\./g,'').replace(/,/g,'');
  let currency = 'IDR';
  if(/\$|usd|dollar/.test(txt)) currency='USD';
  if(/eur|€/.test(txt)) currency='EUR';
  const match = txt.match(/(\d+)/);
  if(!match) return {value:null,currency};
  const value = Number(match[1]);
  return {value,currency};
}

// Bagian computeAndReport baru: tampilan tabel rapi
function computeAndReport(profile){
  const income = profile.income || 0;
  const period = profile.period || 'month';
  const savingsNow = profile.savings || 0;
  const target = profile.target || null;
  const currency = profile.currency || 'IDR';

  let incomePerDay = income;
  if(period==='month') incomePerDay = income / 30;
  if(period==='year') incomePerDay = income / 365;

  let savePct = 0.25, emergencyPct = 0.08;
  let spendPct = 1 - savePct - emergencyPct;
  if(spendPct < 0) spendPct = Math.max(0, 1 - (savePct + emergencyPct));

  const savePerDay = Math.max(0, Math.round(incomePerDay * savePct));
  const emergencyPerDay = Math.max(0, Math.round(incomePerDay * emergencyPct));
  const spendPerDay = Math.max(0, Math.round(incomePerDay * spendPct));

  let multiplier = 1;
  if(period==='month') multiplier=30;
  if(period==='year') multiplier=365;

  const savePeriod = Math.round(savePerDay*multiplier);
  const emergencyPeriod = Math.round(emergencyPerDay*multiplier);
  const spendPeriod = Math.round(spendPerDay*multiplier);

  let totalAllocated = savePeriod + emergencyPeriod + spendPeriod;
  let adjustedSpend = spendPeriod;
  if(totalAllocated>income){
    const diff=totalAllocated-income;
    adjustedSpend = Math.max(0, spendPeriod - diff);
  }

  const tone = (localStorage.getItem('finance_ai_tone')) || 'formal';
  const greet = tone==='formal' ? 'Berikut analisisnya:' : 'Cek ini ya 😊:';

  let estimateTxt='';
  if(target){
    const remaining=Math.max(0,target-savingsNow);
    if(savePerDay<=0){
      estimateTxt='⚠️ Tabungan harian 0, target tidak tercapai.';
    }else{
      const daysNeeded=Math.ceil(remaining/savePerDay);
      estimateTxt=`Estimasi waktu mencapai target ${fmt(target,currency)}: sekitar ${daysNeeded} hari (~${Math.round(daysNeeded/30)} bulan).`;
      if(daysNeeded<1) estimateTxt='⚠️ Target tercapai di bawah 1 hari — periksa input.';
      if(daysNeeded>36500) estimateTxt='⚠️ Estimasi >100 tahun, tidak realistis.';
    }
  }

  const reportLines=[];
  reportLines.push(`${greet}`);
  reportLines.push(`Penghasilan (${period==='day'?'per hari':period==='month'?'per bulan':'per tahun'}): ${fmt(income,currency)}`);
  reportLines.push(`Tabungan sekarang: ${fmt(savingsNow,currency)}`);
  reportLines.push(`Pengeluaran disarankan: ${fmt(adjustedSpend,currency)}`);
  reportLines.push(`Dana darurat disarankan: ${fmt(emergencyPeriod,currency)}`);
  reportLines.push(`Rekomendasi tabungan per ${period}: ${fmt(savePeriod,currency)}`);
  if(target) reportLines.push(estimateTxt);
  reportLines.push(`\nCatatan: Semua angka adalah estimasi dan AI menyesuaikan bila data berubah.`);
  pushAI(reportLines.join('\n'), {typing:true, delay:700});
}

// [The rest of the original code stays unchanged]
