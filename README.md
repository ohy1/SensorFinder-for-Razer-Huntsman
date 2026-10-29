# Razer SensorFinder

Razer Huntsman 아날로그(광학) 키보드에서 **어느 키의 센서가 얼마나 눌린 것으로 감지되는지**를 실시간으로 보여 주는 진단 도구입니다.
호환 키캡을 끼운 뒤 키보드가 미세한 입력을 잡을 때 원인 키를 찾는 용도로 만들었습니다.
Synapse가 설정 대상에서 빼놓은 키(**윈도우 키** 등)의 입력 지점(액추에이션)을 직접 읽고 바꾸는 기능도 들어 있습니다.

**빠른 실행**: 저장소를 내려받은 뒤 `web/index.html`을 데스크톱 Chrome / Edge로 엽니다. GitHub Pages를 켜면 <https://ohy1.github.io/razer-sensorfinder/>에서도 열 수 있습니다.

> 비공식 도구입니다. Razer와 관계없고, 리버스 엔지니어링으로 공개된 프로토콜을 사용합니다. 사용에 따른 책임은 사용자에게 있습니다.

## 지원 모델

| 모델 | PID | 깊이 스트림 | 입력 지점 읽기/쓰기 |
|---|---|---|---|
| Huntsman V2 Analog | `0266` | 리포트 `07`, 1바이트 | `02:92` / `02:12` |
| Huntsman Mini Analog | `0282` | 리포트 `07`, 1바이트 | `02:92` / `02:12` |
| Huntsman V3 Pro / **V3 Pro 8KHz** / V3 Pro TKL / TKL 8KHz / V3 Pro Mini / V3 TKL 8KHz / Signature Edition / V3 Pro Low-profile TKL 8KHz | `02A6` / **`02CF`** / `02A7` / `02D0` / `02B0` / `02E5` / `02D8` / `02E6` | 리포트 `0B`, u16 BE | `02:92` / `02:12` (임계값 = u16의 상위 바이트) |

## 1. 센서 모니터: 어느 키가 걸리는지 찾기

### 실행

1. **Razer Synapse를 실행해 둡니다** (트레이에 있어도 됩니다). Synapse가 켜져 있으면 키보드가 "드라이버 모드"로 동작하며 키별 깊이 데이터를 PC로 보냅니다. 이 도구는 그 데이터를 함께 읽습니다.
2. 데스크톱 **Chrome** 또는 **Edge**에서 `web/index.html`을 엽니다. 파일을 더블클릭해도 되고, 기본 브라우저가 다르면 Chrome 창으로 끌어다 놓으면 됩니다. Pages를 켰다면 <https://ohy1.github.io/razer-sensorfinder/>를 열어도 됩니다.
3. **키보드 연결**을 누르고 목록에서 키보드를 선택합니다.
4. **입력/해제 지점 → 키보드에서 불러오기**를 한 번 누릅니다. 각 키에 설정된 입력 지점과 해제 지점을 읽어 옵니다(약 3초).
   - 그 뒤로는 눌림마다 실제로 **입력됐는지 / 감지만 됐는지**를 판정해 줍니다.
   - 불러온 값은 브라우저에 저장되어 다음에 열 때 다시 쓰입니다. Synapse에서 설정을 바꿨다면 다시 불러오세요.
   - Synapse가 켜진 상태에서 실패하면 Synapse를 잠시 종료하고 불러온 뒤 다시 켜면 됩니다.

### 화면 보는 법

- **키 깊이 맵**: 파랑은 감지 중(입력 지점 전), 초록은 입력 중입니다.
  - 테두리 **주황**은 감지만 되고 한 번도 입력되지 않은 키(미세 접촉), **초록**은 입력된 적이 있는 키입니다.
  - 감지된 키 안의 실선은 입력 지점, 점선은 해제 지점입니다.
- **키 깊이 그래프**: 최근 감지된 키(또는 클릭한 키)의 최근 5초 깊이 변화입니다.
  - 입력 지점(실선)과 해제 지점(점선)이 함께 그려지고, 입력 중이었던 구간은 초록 배경으로 표시됩니다.
  - 마우스를 올리면 그 시점의 깊이가 보입니다.
- **감지 기록**의 판정 칸
  - `입력됨 +121 ms, 162 ms 유지`: 처음 감지된 뒤 121 ms 만에 입력 지점에 닿았고, 해제 지점으로 돌아올 때까지 162 ms 동안 입력 상태였다는 뜻입니다.
  - `미입력 1.20 mm 모자람`: 입력 지점까지 1.2 mm가 남아 입력되지 않았다는 뜻입니다.
- 판정은 읽어 온 입력·해제 지점으로 계산한 **추정**입니다. Rapid Trigger는 반영하지 않습니다.

### 원인 키 찾는 순서

1. 키보드에서 손을 떼고 30초쯤 둡니다. 이때 **주황 테두리가 생기는 키**는 아무도 누르지 않았는데 센서가 눌림을 감지한 키입니다. 키캡이 스템을 미리 누르고 있거나 하우징에 닿아 있을 가능성이 큽니다.
2. 키캡 가장자리를 하나씩 살짝 건드려 봅니다. 눌러야 할 키 말고 옆 키까지 같이 감지되면 그 키캡이 간섭하는 것입니다.
3. **감지된 키 순위** 표에서 *감지 / 입력 횟수*, *최대 깊이*, *여유*(입력 지점 − 최대 깊이)를 확인합니다. 여유가 거의 없는 키는 그 키만 입력 지점을 더 깊게 잡으면 됩니다. 전체 감도를 낮출 필요가 없습니다.
4. 필요하면 **CSV 내보내기**로 기록을 저장합니다.

### 깊이 값 읽는 법

- **V3 계열**: 원시값 0–65535이며 1638 = 0.1 mm입니다. 펌웨어는 0.1 mm보다 얕은 눌림을 보고하지 않으므로, 여기에 뜨는 키는 실제로 0.1 mm 이상 눌린 상태입니다.
- **V2 계열**: 원시값 0–255이며, 임계값과 같은 1.5–3.6 mm 눈금입니다.
- 노이즈는 보통 ±1–2 단위입니다. 너무 자주 깜빡이는 키가 있으면 *노이즈 무시* 값을 올려 보세요.

## 2. 윈도우 키 입력 지점 바꾸기 (Synapse에서 안 되는 키)

V3 펌웨어의 센서 매트릭스에는 윈도우 키(fwID `127`)가 다른 키와 똑같이 아날로그 키로 들어 있습니다. Synapse 화면에서만 빠져 있을 뿐, 키별 설정 명령 `02:92`(읽기) / `02:12`(쓰기)로 다른 키처럼 값을 넣을 수 있습니다.

1. **Synapse를 완전히 종료합니다** (트레이 아이콘 → 종료).
   Synapse가 실행 중이면 키보드는 드라이버 모드이고, 입력 판정을 Synapse가 PC에서 직접 하므로 키보드에 적은 값이 쓰이지 않습니다.
2. `web/index.html` → **키 입력 지점 (윈도우 키)** 탭에서 키(기본값 Win)를 고르고 **현재 값 읽기**를 누릅니다.
3. 새 입력 지점(mm)과 해제 지점(mm)을 넣고 **적용**합니다.
   - 해제 지점은 입력 지점보다 0.1 mm 이상 얕아야 합니다. **추천값** 버튼을 누르면 입력 지점보다 0.2 mm 얕은 값이 들어갑니다.
   - 도구는 현재 값을 다시 읽고, 두 지점만 바꿔 쓴 다음, 한 번 더 읽어서 값이 들어갔는지 확인합니다. 키 기능(fnId)은 그대로 둡니다.
   - **프로필 0 (RAM)**: 바로 적용되지만 키보드를 다시 꽂거나 Synapse가 모드를 바꾸면 원래대로 돌아갑니다. 먼저 이걸로 시험해 보세요.
   - **활성 프로필 슬롯 (플래시)**: 키보드에 저장됩니다. Huntsman V3 Pro 8KHz 실기기에서 윈도우 키를 2.7 mm로 저장한 뒤 Synapse를 켰을 때도 2.7 mm 근처에서 입력되는 것을 확인했습니다.
   - Synapse에서 프로필을 바꾸거나 Synapse가 설정을 다시 쓸 때 값이 덮어써질 수 있습니다. 가끔 **현재 값 읽기**로 확인하세요.

**알아 둘 점**

- 실기기 확인: V3 Pro Mini([easyrazer #45](https://github.com/janeblower/easyrazer/issues/45)), V3 Pro 8KHz(이 저장소).
- 다른 모델은 RAM부터 시험하세요.
- 윈도우 키 실수 입력만 막으면 된다면 Synapse의 **게임 모드**(윈도우 키 비활성화)도 방법입니다.
- 오른쪽 윈도우 키 자리는 Razer 보드에서 Fn 키(fwID `59`)입니다. Fn은 레이어 전환용이라 조절 대상이 아닙니다.

## 3. 명령줄 도구 (브라우저로 안 될 때)

```bash
pip install hidapi
```

```bash
python python/razer_sensorfinder.py list
```

```bash
python python/razer_sensorfinder.py monitor --csv touches.csv
```

```bash
python python/razer_sensorfinder.py get-key --key Win
```

```bash
python python/razer_sensorfinder.py set-key --key Win --mm 3.0
```

```bash
python python/razer_sensorfinder.py set-key --key Win --mm 2.7 --release-mm 2.5 --profile active
```

- `monitor`: 깊이 스트림을 보여 줍니다(Synapse 실행 필요). Ctrl+C로 끝내면 감지 횟수 순으로 요약해 줍니다.
- `get-key` / `set-key`: Synapse를 종료한 상태에서 씁니다. `--profile` 기본값은 `0`(RAM)이고, `active`를 주면 플래시에 저장합니다.

## 기존 GitHub 자료

| 저장소 | 내용 | 이번 용도에 맞는 점 |
|---|---|---|
| [AnalogSense/JavaScript-SDK](https://github.com/AnalogSense/JavaScript-SDK) | WebHID 기반 아날로그 입력 라이브러리. Huntsman V2/Mini/V3 Pro/V3 Pro Mini/TKL 지원(Synapse 실행 필요) | 깊이 스트림을 브라우저에서 읽는 방식의 원형. 지원 목록에 8KHz PID(`02CF`)가 없고, 누른 키의 현재값만 보여 줘서 이력이나 원인 키 찾기 기능이 없음 |
| [janeblower/easyrazer](https://github.com/janeblower/easyrazer) | Huntsman 아날로그 보드용 Synapse 대체 앱(Windows, Rust) | 프로토콜 문서가 가장 자세함. 윈도우 키도 액추에이션 편집 가능. 단, V3 Pro 8KHz는 "구현됐으나 실기기 미검증"이고 설정에서 따로 허용해야 씀 |
| [cidious/razer-analog-linux](https://github.com/cidious/razer-analog-linux) | Linux 데몬. `dump`로 key_id·depth 원시값 출력 | V2 Analog 전용 |
| [meeuw/razer-analog](https://github.com/meeuw/razer-analog) | Linux, Mini Analog를 가상 마우스로 사용 | V2 계열 전용 |
| [AnalogSense/universal-analog-plugin](https://github.com/AnalogSense/universal-analog-plugin) | Wooting Analog SDK 플러그인 | 게임 연동용 |
| [PashOK7/HallJoy](https://github.com/PashOK7/HallJoy) | 아날로그 키보드를 가상 게임패드로 쓰는 Windows 앱(AGPL-3.0) | 키 이동 거리 오버레이가 있지만, 키보드에 설정된 입력·해제 지점을 읽지 않음. 지원 목록에 8KHz 없음 |
| [Kaillr/better-key-overlay](https://github.com/Kaillr/better-key-overlay) | osu! 방송용 키 오버레이(AnalogSense 사용) | 압력 그래프는 있지만 진단용이 아님 |

이 저장소처럼 **키별 감지 이력, 키보드에서 읽은 입력·해제 지점으로 한 입력 판정, Synapse에 없는 키의 지점 설정**을 함께 하는 도구는 찾지 못했습니다(2026-10 기준).
이 저장소는 위 자료에서 **프로토콜 정보만** 참고했습니다. 코드는 새로 작성했습니다.

## 프로토콜 메모

- **깊이 스트림** (드라이버 모드에서만): 인터페이스 1(MI_01)의 입력 리포트입니다.
  - V2: `07 (fwID depth)…`
  - V3: `0B (fwID depthHi depthLo)…`, 최대 15개, `fwID 0`에서 끝납니다.
  - 값이 바뀔 때만 오고, 빈 리포트는 전부 뗀 상태입니다.
- **제어**: 인터페이스 3(MI_03)의 90바이트 기능 리포트(report ID 0)입니다.

  ```
  0 status | 1 transaction 0x1F | 2-3 remaining | 4 protocol | 5 size | 6 class | 7 id | 8-87 args | 88 XOR(2..87) | 89 0
  ```

  응답 status: `02` 정상, `01` busy, `03` 실패, `05` 미지원.
- **키 설정** `02:92` / `02:12`: `[profile, fwID, layer, thrL(입력), thrH(해제), fnId, fnSize, fnData…]`, size `0x50`.
  - V3: 임계값 = u16(1638 = 0.1 mm)의 상위 바이트입니다. 0–255가 0–4.0 mm에 대응합니다.
  - V2: 0–255가 1.5–3.6 mm에 대응합니다.
- **fwID**는 AT-101 위치 코드입니다. 예: Q = 17, A = 31, Space = 61, Win = 127, Fn = 59, 한자 = 152, 한/영 = 153.

## 개발

### GitHub Pages 배포

`.github/workflows/pages.yml`은 모든 push에서 테스트를 돌립니다. 기본 브랜치에 push되면 `web/` 폴더를 GitHub Pages에 배포합니다.
배포는 기본적으로 꺼져 있습니다. 켜는 방법은 다음과 같습니다.
1. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿉니다.
2. **Settings → Secrets and variables → Actions → Variables**에 `PAGES_ENABLED` = `true`를 추가합니다.
3. Actions 탭에서 워크플로를 다시 실행합니다.
비공개 저장소에서 Pages를 쓰려면 GitHub Pro 이상이 필요합니다. 무료 계정이면 저장소를 공개로 바꿔야 합니다.

### 테스트

```bash
node --test "tests/*.test.js"
```

```bash
python -m unittest discover tests
```

테스트는 패킷 레이아웃, CRC, 깊이 리포트 파싱, 임계값 변환을 확인합니다.
웹 UI는 가상 HID 장치로 동작을 확인했습니다. 실제 키보드에서는 아직 시험하지 않았습니다.
처음 쓸 때 문제가 있으면 *원시 HID 리포트* 내용을 이슈로 남겨 주세요.
