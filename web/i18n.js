/*
 * UI strings. Korean for Korean browsers, English for everyone else; the header button switches.
 * Values may contain {name} placeholders. Keys ending in Html are inserted as HTML (trusted, static).
 */
(function (root) {
  'use strict';

  const STRINGS = {
    ko: {
      subtitle: 'Razer Huntsman 아날로그(광학) 키보드에서 실제로 눌림이 감지되는 키와 깊이를 실시간으로 보여주고, 키별 입력 지점(윈도우 키 포함)을 직접 설정합니다.',
      unsupportedHtml: '이 브라우저는 WebHID를 지원하지 않습니다. 데스크톱 <b>Chrome</b> 또는 <b>Edge</b>로 여세요.',
      langButton: 'English',
      connect: '키보드 연결',
      notConnected: '연결 안 됨',
      disconnected: '연결 끊김',
      reports: '리포트',
      unknownModel: '미확인 모델',
      driverMode: '드라이버 모드 (깊이 스트림 수신 중)',
      tabMonitor: '센서 모니터',
      tabActuation: '키 입력 지점 (윈도우 키)',

      mapTitle: '키 깊이 맵',
      noise: '노이즈 무시: 원시값 ≤',
      reset: '기록 초기화',
      csv: 'CSV 내보내기',
      thrLabel: '입력/해제 지점',
      optActiveSlot: '활성 프로필 슬롯',
      optRam: '프로필 0 (RAM)',
      thrLoad: '키보드에서 불러오기',
      thrNotLoaded: '아직 불러오지 않음 — 불러오면 입력이 실제로 됐는지 판정합니다',
      legendSense: '감지 중(입력 지점 전)',
      legendOn: '입력 중',
      legendRestHtml: '· 테두리: <b style="color: var(--warn)">주황</b> = 감지만 되고 입력된 적 없음(미세 접촉), <b class="ok">초록</b> = 입력된 적 있음 · 숫자 = 감지 횟수 · 감지된 키 안의 실선 = 입력 지점, 점선 = 해제 지점. 키를 클릭하면 아래 그래프에 표시됩니다.',
      noStreamHtml: '연결은 됐지만 깊이 데이터가 들어오지 않습니다. 깊이 스트림은 키보드가 <b>드라이버 모드</b>일 때만 나옵니다. <b>Razer Synapse를 실행</b>해 둔 상태(트레이 포함)에서 키를 눌러 보세요.',
      extraKey: '레이아웃 밖 키: {name} · {n}회 · 현재 {live}',

      chartTitle: '키 깊이 그래프 (최근 5초)',
      chartTitleKey: '키 깊이 그래프 — {name} (최근 5초)',
      follow: '최근 감지된 키 따라가기',
      readoutIdle: '키를 누르거나 맵에서 키를 클릭하세요.',
      chartNoteHtml: '입력/해제 판정은 불러온 입력·해제 지점으로 계산한 <b>추정</b>입니다. Rapid Trigger는 반영하지 않습니다.',
      axisNow: '지금',
      chartAct: '입력 {mm} mm',
      chartRel: '해제 {mm} mm',
      tipAgo: '{s} s 전 · {mm} mm',
      tipOn: ' · 입력 중',
      tipOff: ' · 입력 아님',
      readout: '현재 {cur} mm · 최근 5초 최대 {peak} mm',
      readoutPoints: ' · 입력 {on} / 해제 {off} mm',
      stUnknown: '입력/해제 지점 미확인',
      stOn: '● 입력 중',
      stSensing: '감지 중 (입력 전)',
      stIdle: '대기',

      rankTitle: '감지된 키 순위',
      rankNote: '여유 = 입력 지점 − 최대 깊이. 여유가 남아 있으면 그 키는 한 번도 입력 지점까지 눌리지 않은 것입니다.',
      thKey: '키',
      thTouches: '감지',
      thInputs: '입력',
      thPeak: '최대 깊이',
      thPoints: '입력 / 해제 지점',
      thMargin: '여유',
      noKeys: '아직 감지된 키가 없습니다.',
      logTitle: '감지 기록 (최신순)',
      thTime: '시각',
      thDuration: '지속',
      thVerdict: '판정',
      noEvents: '기록 없음',
      inProgress: '진행 중',
      inputOn: '입력 중',
      sensing: '감지 중',
      verdictUnknown: '지점 미확인',
      verdictFired: '입력됨',
      verdictFiredDetail: '+{ms} ms, {held} 유지',
      verdictMissed: '미입력',
      verdictShort: '{mm} mm 모자람',

      rawTitle: '원시 HID 리포트 (최근 20개)',
      rawShow: '표시',
      rawNote: '목록에 없는 모델이거나 값이 이상하면 이 내용을 이슈로 남겨 주세요.',

      thrCached: '저장해 둔 지점 사용 중 (프로필 {p}, {date}) — 설정을 바꿨다면 다시 불러오세요',
      thrLoading: '불러오는 중… {i} / {n}',
      thrLoaded: '프로필 {p}에서 {n}개 키를 불러왔습니다 ({time})',
      thrSkipped: ' · {n}개는 해당 없음',
      thrFailed: '불러오기 실패: {err} — Synapse를 잠시 종료한 뒤 다시 시도해 보세요',
      noKeysRead: '읽은 키가 없습니다',

      actTitle: '키별 입력 지점 읽기 / 설정',
      actIntroHtml: 'Synapse가 조절 대상에서 빼놓은 키(윈도우 키 등)도 펌웨어 명령 <code>02:92</code> / <code>02:12</code>로 직접 읽고 쓸 수 있습니다.',
      actWarnHtml: '<b>먼저 Synapse를 완전히 종료하세요</b> (트레이 아이콘 → 종료). Synapse가 실행 중이면 키보드는 드라이버 모드이고, 입력 판정을 Synapse가 PC에서 직접 하므로 키보드에 적은 값이 무시됩니다. Synapse가 시작하거나 종료되며 모드를 바꾸면 <b>프로필 0(RAM)</b> 값은 활성 프로필 값으로 덮어써집니다.',
      actKey: '키',
      actTarget: '대상',
      actOptRam: '프로필 0 — RAM (재연결하면 원래대로)',
      actOptSlot: '활성 프로필 슬롯 — 플래시에 저장',
      actRead: '현재 값 읽기',
      actNewPoint: '새 입력 지점',
      actRelease: '해제 지점',
      actSuggest: '추천값',
      actSuggestTitle: '입력 지점보다 0.2 mm 얕게',
      actApply: '적용',
      actHelpHtml: '입력 지점: 값이 클수록 더 깊이 눌러야 입력됩니다 (V3 계열 0.1–4.0 mm, V2 계열 1.5–3.6 mm).<br>해제 지점: 키가 이 깊이보다 위로 올라와야 떼어진 것으로 처리됩니다. 입력 지점보다 0.1 mm 이상 얕아야 하고, 0.1–0.2 mm 차이가 일반적입니다. 차이가 너무 작으면 경계에서 입력이 떨릴 수 있습니다. 비워 두면 기존 값을 유지합니다.',
      dtKey: '키',
      dtProfile: '프로필',
      profRam: '0 (RAM)',
      profSlot: '{n} (플래시 슬롯)',
      dtAct: '입력 지점 thrL',
      dtRel: '해제 지점 thrH',
      dtFn: '기능',
      readOk: '읽기 성공: {key} 프로필 {p}',
      readFail: '읽기 실패: {err}',
      writeOk: '적용 확인',
      writeMismatch: '적용했지만 읽어 온 값이 다름',
      writeDetail: '{key} 프로필 {p} 입력 {a} → {b} mm, 해제 {c} → {d} mm',
      writeFail: '적용 실패: {err}',
      confirmFlash: '프로필 슬롯 {p}의 플래시에 저장합니다. 계속할까요?',

      errConnectFirst: '먼저 키보드를 연결하세요',
      errOpen: '장치를 열 수 없습니다. 다른 프로그램이 독점하고 있는지 확인하세요.',
      errNoControl: '제어 인터페이스를 찾지 못했습니다',
      errBadReply: '응답 형식이 다릅니다',
      errStatus: '키보드 응답: {s}',
      errBusy: '키보드가 계속 busy 상태입니다',
      errProfile: '활성 프로필 번호가 이상합니다: {n}',
      errKeyReply: '키 정보 응답이 이상합니다: {hex}',
      errRange: '{lo}–{hi} mm 범위로 입력하세요',
      errRelease: '해제 지점은 입력 지점({mm} mm)보다 0.1 mm 이상 얕아야 합니다',

      footer: '비공식 도구입니다. Razer와 관계없습니다. 프로토콜은 공개된 리버스 엔지니어링 자료(easyrazer, AnalogSense, razer-analog-linux)를 바탕으로 합니다. 사용에 따른 책임은 사용자에게 있습니다.',
      keyNames: { 150: '무변환', 151: '가나', 152: '한자', 153: '한/영', 154: '변환' },
    },

    en: {
      subtitle: 'See which keys of a Razer Huntsman analog (optical) keyboard the sensors register and how deep, live, and set per-key actuation points (Windows key included).',
      unsupportedHtml: 'This browser does not support WebHID. Open the page in desktop <b>Chrome</b> or <b>Edge</b>.',
      langButton: '한국어',
      connect: 'Connect keyboard',
      notConnected: 'Not connected',
      disconnected: 'Disconnected',
      reports: 'Reports',
      unknownModel: 'unknown model',
      driverMode: 'Driver mode (receiving depth stream)',
      tabMonitor: 'Sensor monitor',
      tabActuation: 'Key actuation (Windows key)',

      mapTitle: 'Key depth map',
      noise: 'Ignore noise: raw ≤',
      reset: 'Clear',
      csv: 'Export CSV',
      thrLabel: 'Actuation / release points',
      optActiveSlot: 'Active profile slot',
      optRam: 'Profile 0 (RAM)',
      thrLoad: 'Load from keyboard',
      thrNotLoaded: 'Not loaded yet — load them to see whether presses really registered',
      legendSense: 'Sensed (before actuation)',
      legendOn: 'Input on',
      legendRestHtml: '· Border: <b style="color: var(--warn)">orange</b> = sensed but never registered (light contact), <b class="ok">green</b> = registered at least once · number = times sensed · in sensed keys, solid line = actuation point, dashed = release point. Click a key to graph it below.',
      noStreamHtml: 'Connected, but no depth data is coming in. The keyboard only streams depth in <b>driver mode</b>. Keep <b>Razer Synapse running</b> (the tray icon is enough) and press a key.',
      extraKey: 'Key outside the layout: {name} · {n}× · now {live}',

      chartTitle: 'Key depth graph (last 5 s)',
      chartTitleKey: 'Key depth graph — {name} (last 5 s)',
      follow: 'Follow the last sensed key',
      readoutIdle: 'Press a key or click one on the map.',
      chartNoteHtml: 'Input on/off is an <b>estimate</b> from the loaded actuation and release points. Rapid Trigger is not modelled.',
      axisNow: 'now',
      chartAct: 'Actuation {mm} mm',
      chartRel: 'Release {mm} mm',
      tipAgo: '{s} s ago · {mm} mm',
      tipOn: ' · input on',
      tipOff: ' · no input',
      readout: 'Now {cur} mm · 5 s max {peak} mm',
      readoutPoints: ' · actuation {on} / release {off} mm',
      stUnknown: 'actuation / release points unknown',
      stOn: '● input on',
      stSensing: 'sensed (not yet registered)',
      stIdle: 'idle',

      rankTitle: 'Sensed keys',
      rankNote: 'Margin = actuation point − deepest press. A key with margin left never reached its actuation point.',
      thKey: 'Key',
      thTouches: 'Sensed',
      thInputs: 'Inputs',
      thPeak: 'Deepest',
      thPoints: 'Actuation / release',
      thMargin: 'Margin',
      noKeys: 'No keys sensed yet.',
      logTitle: 'Log (newest first)',
      thTime: 'Time',
      thDuration: 'Duration',
      thVerdict: 'Result',
      noEvents: 'Nothing yet',
      inProgress: 'ongoing',
      inputOn: 'Input on',
      sensing: 'Sensed',
      verdictUnknown: 'points unknown',
      verdictFired: 'Registered',
      verdictFiredDetail: '+{ms} ms, held {held}',
      verdictMissed: 'Not registered',
      verdictShort: '{mm} mm short',

      rawTitle: 'Raw HID reports (last 20)',
      rawShow: 'Show',
      rawNote: 'If your model is not listed or the values look wrong, please open an issue with this output.',

      thrCached: 'Using saved points (profile {p}, {date}) — load again if you changed settings',
      thrLoading: 'Loading… {i} / {n}',
      thrLoaded: 'Loaded {n} keys from profile {p} ({time})',
      thrSkipped: ' · {n} not applicable',
      thrFailed: 'Loading failed: {err} — quit Synapse for a moment and try again',
      noKeysRead: 'no keys could be read',

      actTitle: 'Read / set a key’s actuation point',
      actIntroHtml: 'Keys Synapse leaves out (such as the Windows key) can be read and written directly with the firmware commands <code>02:92</code> / <code>02:12</code>.',
      actWarnHtml: '<b>Quit Synapse completely first</b> (tray icon → Quit). While Synapse runs the keyboard is in driver mode and Synapse decides presses on the PC, so values written to the keyboard are not used. When Synapse starts or quits and switches modes, <b>profile 0 (RAM)</b> is overwritten from the active profile.',
      actKey: 'Key',
      actTarget: 'Target',
      actOptRam: 'Profile 0 — RAM (reverts on replug)',
      actOptSlot: 'Active profile slot — saved to flash',
      actRead: 'Read current value',
      actNewPoint: 'New actuation point',
      actRelease: 'Release point',
      actSuggest: 'Suggest',
      actSuggestTitle: '0.2 mm shallower than the actuation point',
      actApply: 'Apply',
      actHelpHtml: 'Actuation point: the larger the value, the deeper a key must go to register (V3 line 0.1–4.0 mm, V2 line 1.5–3.6 mm).<br>Release point: the key counts as released once it rises above this depth. It must be at least 0.1 mm shallower than the actuation point; 0.1–0.2 mm is typical. Too small a gap can make the input chatter at the edge. Leave it empty to keep the current value.',
      dtKey: 'Key',
      dtProfile: 'Profile',
      profRam: '0 (RAM)',
      profSlot: '{n} (flash slot)',
      dtAct: 'Actuation thrL',
      dtRel: 'Release thrH',
      dtFn: 'Function',
      readOk: 'Read: {key}, profile {p}',
      readFail: 'Read failed: {err}',
      writeOk: 'Applied and verified',
      writeMismatch: 'Applied, but the read-back value differs',
      writeDetail: '{key}, profile {p}: actuation {a} → {b} mm, release {c} → {d} mm',
      writeFail: 'Apply failed: {err}',
      confirmFlash: 'This writes to the flash of profile slot {p}. Continue?',

      errConnectFirst: 'Connect the keyboard first',
      errOpen: 'Could not open the device. Check that no other program holds it exclusively.',
      errNoControl: 'control interface not found',
      errBadReply: 'unexpected reply format',
      errStatus: 'keyboard answered: {s}',
      errBusy: 'keyboard stayed busy',
      errProfile: 'unexpected active profile: {n}',
      errKeyReply: 'unexpected key reply: {hex}',
      errRange: 'Enter a value within {lo}–{hi} mm',
      errRelease: 'The release point must be at least 0.1 mm shallower than the actuation point ({mm} mm)',

      footer: 'Unofficial tool, not affiliated with Razer. The protocol comes from public reverse-engineering work (easyrazer, AnalogSense, razer-analog-linux). Use at your own risk.',
      keyNames: { 150: 'Muhenkan', 151: 'Kana', 152: 'Hanja', 153: 'Han/Yeong', 154: 'Henkan' },
    },
  };

  const STORE_KEY = 'rsf.lang';

  function detect() {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved && STRINGS[saved]) return saved;
    } catch (err) { /* storage unavailable */ }
    const first = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return first.toLowerCase().startsWith('ko') ? 'ko' : 'en';
  }

  const I18N = {
    lang: typeof navigator === 'undefined' ? 'en' : detect(),
    strings: STRINGS,

    t(key, vars) {
      const s = STRINGS[this.lang][key] ?? STRINGS.en[key] ?? key;
      return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
    },

    set(lang) {
      this.lang = STRINGS[lang] ? lang : 'en';
      try { localStorage.setItem(STORE_KEY, this.lang); } catch (err) { /* not remembered */ }
    },

    locale() {
      return this.lang === 'ko' ? 'ko-KR' : 'en-US';
    },

    /** Fills elements marked data-i18n (text), data-i18n-html (HTML) and data-i18n-title. */
    apply(root) {
      document.documentElement.lang = this.lang;
      for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = this.t(el.dataset.i18n);
      for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = this.t(el.dataset.i18nHtml);
      for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = this.t(el.dataset.i18nTitle);
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = { STRINGS };
  else root.I18N = I18N;
})(typeof self !== 'undefined' ? self : this);
