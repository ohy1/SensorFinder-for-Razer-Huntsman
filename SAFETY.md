# 안전 정책 / Safety policy

[English below](#english)

SensorFinder for Razer Huntsman은 Razer와 관계없는 **비공식** 도구입니다.
리버스 엔지니어링으로 공개된 프로토콜을 사용하며, [MIT 라이선스](LICENSE)에 따라 **어떠한 보증도 없이** 제공됩니다.
사용에 따른 결과는 사용자 책임입니다.

## 이 도구가 키보드에 보내는 명령

코드에 허용 목록이 있어서, 아래 4가지 외의 명령은 키보드로 보내기 전에 차단됩니다(`web/razer-protocol.js`의 `checkPacket`, `python/sensorfinder.py`의 `check_packet`).

| 명령 | 내용 | 종류 |
|---|---|---|
| `02:92` | 키 하나의 입력·해제 지점 읽기 | 읽기 |
| `05:84` | 활성 프로필 번호 읽기 | 읽기 |
| `00:84` | 장치 모드 읽기 (Synapse 실행 여부 확인) | 읽기 |
| `02:12` | 키 하나의 입력·해제 지점 쓰기 | **쓰기** |

**보내지 않는 명령**: 펌웨어·부트로더, 모드 전환(`00:04`), 공장 센서 보정(`FE:xx`), 프로필 생성·삭제·전환, 조명, 매크로 등. 특히 모드 전환 명령의 모드 `01`은 키보드를 부트로더로 보내므로 절대 보내지 않습니다.

깊이 모니터는 키보드가 원래 보내는 입력 리포트를 **읽기만** 합니다.

## 쓰기(`02:12`)에 걸린 안전장치

- **명시적 조작만**: 사용자가 **적용** 또는 **되돌리기**를 누를 때만 씁니다. 한 번에 키 하나만 쓰고, 처리 중에는 버튼이 잠겨 중복 쓰기가 생기지 않습니다.
- **확인된 모델만, 한 대만**: 쓰기는 지원 목록에 있는 모델에만 합니다. 다른 Razer 기기(마우스 등)나 모르는 모델에는 쓰지 않습니다. 같은 모델 키보드가 두 대 이상 연결돼 있으면 하나를 고를 때까지 쓰기를 막고, **키보드 연결**로 하나를 고르면 나머지는 놓습니다.
- **작업 중 장치 변경 차단**: 읽기·쓰기·되돌리기가 진행되는 동안에는 다른 키보드로 바꿀 수 없습니다. 도중에 키보드가 바뀌거나 빠지면 쓰지 않고 멈춥니다. 쓰기는 **현재 값 읽기**를 한 바로 그 장치로만 가며, 그 장치가 빠지면(같은 키보드를 다시 꽂아도) 다시 읽어야 씁니다.
- **모델별 값 범위 검사** (허용 목록에서 한 번 더 검사)
  - 입력 지점: V3 계열 0.1–4.0 mm, V3 Pro Low-profile TKL 8KHz 0.1–2.8 mm(스위치 이동 거리), V2 계열 약 1.62–3.56 mm(펌웨어 범위)
  - 해제 지점: 입력 지점보다 약 0.1 mm 이상 얕아야 함(펌웨어 최소 간격 V2 0.08 mm, V3 0.09 mm; V2는 펌웨어 하한 1.54 mm도 지킴)
  - 범위 밖 값은 범위 안으로 깎아서 쓰지 않고 거부
  - 일반 레이어, 프로필 0–6, 알려진 키만 허용
- **읽고-고치고-확인**: 현재 값을 읽어 입력·해제 지점만 바꿔 쓰고, 다시 읽어 확인합니다. 키 기능(fnId)은 그대로 둡니다. 손대지 않은 칸은 읽어 온 값 그대로 씁니다. 읽은 뒤에 키 값이 바뀌었으면 다시 읽을 때까지 쓰지 않습니다.
- **다른 응답 무시**: 다른 프로그램(Synapse)의 응답이 섞여도 프로필·키·레이어가 맞는 응답만 받습니다. 거절(`03`/`05`) 응답도 다른 키를 가리키면 그 키의 답으로 보지 않습니다.
- **Synapse 경고**: 키보드가 드라이버 모드(Synapse 실행 중)이거나 모드를 알 수 없으면, 쓰기와 되돌리기 전에 확인 창을 띄웁니다.
- **RAM 먼저**: 기본 대상은 RAM(프로필 0)입니다. 플래시 저장은 별도 확인을 거칩니다.
- **결과를 확인하지 못한 쓰기**: 쓴 뒤 확인 읽기에 실패하면 "실패"가 아니라 "확인하지 못함"으로 알리고, 되돌리기를 남겨 두며, 모니터 지점도 다시 불러오라고 안내합니다.

웹 화면에만 있는 장치
- **첫 사용 동의**: 쓰기와 되돌리기 모두 안전 확인 항목에 동의해야 합니다.
- **되돌리기**: 마지막 쓰기 직전 값으로 정확히 복원합니다(Synapse가 쓴 0/0 "PC가 판정" 값도 그대로 복원하므로, 이 경우에만 위 범위 검사의 예외입니다). 새로고침이나 키보드 재연결 뒤에도 같은 모델이면 남아 있지만, 그 뒤에는 같은 키보드인지 알 수 없으므로 쓰기 전에 한 번 더 묻습니다. 키의 현재 값이 이 도구가 썼던 값과 다르면(다른 키보드이거나 그 사이 바뀐 경우)에도 묻습니다. 연결된 상태에서 **키보드 연결**로 다른 키보드를 고르면 이전 키보드의 되돌리기와 지점은 넘어가지 않고(그 뒤 다시 고르거나 재연결해도 마찬가지), 쓰던 키보드를 다시 고르면 그대로 남습니다. 어느 키보드의 것인지 모르는 기록(새로고침·재연결 뒤)은 어느 키보드를 고르든 남고, 쓰기 전에 묻습니다. 재연결 뒤 플래시 키가 이미 원래 값이면 다른 키보드일 수 있으므로, 되돌리기 기록을 지울지 먼저 묻습니다. 원래 값이 이 도구의 범위 밖이라 되돌릴 수 없으면 쓰기 전에 미리 알리고, 이전 되돌리기 기록은 지웁니다.

명령줄 도구(`set-key`)에는 동의 화면과 되돌리기 버튼이 없습니다. 대신 어떤 질문보다 먼저 원래 값과 **그대로 되돌리는 명령**(슬롯 번호와 정확한 값 포함)을 출력하고, 그 명령으로 되돌릴 수 없는 값(Synapse의 0/0 포함)이면 미리 묻습니다. 질문에 답하는 사이 키 값이 바뀌었으면 쓰지 않습니다. 모드를 읽지 못하거나 모르는 모드 값이 오면 Synapse 경고를 띄웁니다. 같은 모델 키보드가 두 대 이상 연결돼 있으면 구별할 수 없으므로 쓰지 않습니다(쓸 키보드만 남기세요). `--yes`는 질문만 건너뛰고 경고는 계속 출력합니다.

## 문제가 생겼을 때

1. **RAM(프로필 0)에 쓴 값**: 키보드를 뽑았다 다시 꽂으면 원래대로 돌아갑니다.
2. **플래시에 저장한 값**: 키보드가 연결된 상태에서 **되돌리기**를 누릅니다. 연결이 끊겼다면 다시 꽂고(자동으로 다시 연결되지 않으면 **키보드 연결**) 누르세요.
   되돌리기가 없다면 원래 값을 직접 다시 씁니다.
   - V3 계열: Synapse 기본값 입력 1.2 / 해제 1.1 mm
   - V2 계열(V2 Analog, Mini Analog): Synapse는 0/0(PC가 판정)을 씁니다. 이 도구로는 입력 1.62 mm(펌웨어 기본값과 같은 위치), 해제 칸 비우기로 가장 가깝게 맞출 수 있고, 정확한 원래 상태는 3번으로 되돌립니다.
3. **Razer Synapse**에서 프로필을 다시 적용하거나, 키보드 설정을 초기화합니다.
4. 그래도 이상하면 [이슈](https://github.com/ohy1/SensorFinder-for-Razer-Huntsman/issues)를 남겨 주세요. 모델명, 펌웨어 버전, 한 일, 화면의 로그와 *원시 HID 리포트*를 함께 적어 주시면 됩니다.

## 알려진 한계

- 입력/해제 판정은 읽어 온 지점으로 계산한 **추정**입니다. Rapid Trigger는 반영하지 않습니다.
- Synapse가 실행 중이면 키보드가 활성 프로필 번호에 응답하지 않습니다. 이때는 RAM 값을 사용합니다.
- 실기기 확인은 Huntsman V3 Pro 8KHz에서 했습니다. 다른 모델은 프로토콜 문서 기준이므로 RAM부터 시험하세요.
- 브라우저(WebHID)는 일련번호를 알려 주지 않아 같은 모델 키보드 두 대를 구별하지 못합니다. 두 대가 함께 연결되면 쓰기를 막고, **키보드 연결**로 고른 한 대만 남깁니다. 키보드를 뺐다 다른 키보드를 꽂은 경우는 재연결과 구별되지 않으므로, 되돌리기가 쓰기 전에 묻습니다.
- Synapse를 켜거나 끄면 깊이 스트림이 다시 시작되거나 멈춥니다. 페이지는 창으로 돌아올 때와 쓰기 탭을 열 때 모드를 다시 확인하고, 그때 '입력 중'으로 남아 있던 키는 마지막 리포트 시각에 끊긴 것으로 처리합니다. 그 전까지는 이전 상태가 보일 수 있습니다.
- 지점을 읽어 온 키보드가 빠지고 같은 모델의 다른 키보드가 남으면, 지금 키보드에서 다시 불러오라고 안내합니다.
- RAM(프로필 0)에 쓴 값은 재연결하면 돌아가므로 저장해 둔 지점에 넣지 않습니다. 쓴 뒤 새로고침하면 저장된 지점을 쓰면서 다시 불러오라고 안내합니다.
- 목록에 없는 모델은 V3 형식(리포트 `0B`) 깊이 데이터를 보낼 때만 모니터가 동작합니다. 그 밖의 형식이면 원시 리포트를 이슈로 남겨 달라고 안내합니다.

## 보안 문제 제보

보안 관련 문제는 공개 이슈 대신 GitHub의 **Security → Report a vulnerability**로 알려 주세요.

---

<a id="english"></a>

## English

SensorFinder for Razer Huntsman is an **unofficial** tool, not affiliated with Razer.
It uses a protocol published through reverse engineering and comes **without any warranty** under the [MIT License](LICENSE).
You use it at your own risk.

### Commands sent to the keyboard

An allowlist in code blocks everything except these four commands before it is sent (`checkPacket` in `web/razer-protocol.js`, `check_packet` in `python/sensorfinder.py`).

| Command | What | Kind |
|---|---|---|
| `02:92` | read one key's actuation / release point | read |
| `05:84` | read the active profile number | read |
| `00:84` | read the device mode (is Synapse running) | read |
| `02:12` | write one key's actuation / release point | **write** |

**Never sent**: firmware/bootloader, mode switching (`00:04`, whose mode `01` drops the keyboard into its bootloader), factory sensor calibration (`FE:xx`), profile create/delete/switch, lighting, macros, and so on.

The depth monitor only **reads** input reports the keyboard already sends.

### Safeguards on writes (`02:12`)

- **Explicit action only**: writes happen only when you press **Apply** or **Undo**, one key at a time; the buttons lock while a request runs, so a double click cannot write twice.
- **Known models, one keyboard**: writes are only sent to models on the supported list, never to other Razer devices (mice etc.) or unknown models. With two or more keyboards of the same model connected, writes are blocked until you pick one; picking one with **Connect keyboard** lets go of the others.
- **No device switch mid-operation**: while a read, write or undo runs the keyboard cannot be switched; if it changes or disconnects meanwhile, nothing is written. A write only goes to the device **Read current value** was used on; if that device goes away (even when the same keyboard is plugged back in), read again before writing.
- **Per-model range checks** (checked again by the allowlist)
  - Actuation point: 0.1–4.0 mm on the V3 line, 0.1–2.8 mm on the V3 Pro Low-profile TKL 8KHz (switch travel), about 1.62–3.56 mm on the V2 line (firmware range)
  - Release point: about 0.1 mm or more shallower than the actuation point (the firmware's minimum gap, 0.08 mm on V2 and 0.09 mm on V3; and the V2 firmware floor of 1.54 mm)
  - Out-of-range values are refused, never clamped into range
  - Normal layer, profiles 0–6 and known keys only
- **Read-modify-verify**: reads the current value, changes only the two points, reads it back to verify. The key's function (fnId) is kept, and a field left as read is written back exactly. If the key changed since it was read, nothing is written until you read it again.
- **Other replies ignored**: when another program's (Synapse's) replies mix in, only a reply matching the profile, key and layer is accepted. A refusal (`03`/`05`) naming another key is not taken as this key's answer either.
- **Synapse warning**: if the keyboard is in driver mode (Synapse running) or its mode cannot be read, a confirmation dialog appears before writing or undoing.
- **RAM first**: the default target is RAM (profile 0); saving to flash asks again.
- **Unconfirmed writes**: if the read-back after a write fails, it is reported as "could not confirm", not "failed"; Undo stays available and the monitor asks you to load its points again.

Web page only
- **First-use consent**: required for writing and for Undo.
- **Undo**: restores exactly the values the last write replaced (including Synapse's 0/0 "decided on the PC", the one exception to the range checks above); it survives a reload or replug for the same model, but after one it cannot tell whether it is the same keyboard, so it asks once more before writing. It also asks when the key no longer holds what this tool wrote (another keyboard, or changed since). Picking another keyboard with **Connect keyboard** while one is connected does not carry the previous keyboard's Undo or points over (nor does picking or replugging it again later); picking the keyboard in use keeps them. A record whose keyboard is unknown (after a reload or reconnect) stays whichever keyboard you pick, and asks before writing. If after a reconnect a flash key already holds the original values, it may be another keyboard, so you are asked before the Undo record is deleted. If the original values are outside this tool's range, so Undo could not write them back, you are told before writing and the older Undo record is cleared.

The command-line `set-key` has no consent screen or Undo button. Instead, before asking anything, it prints the original values and a **ready-to-run restore command** (explicit slot number, exact values), and asks first if that command could not restore them (Synapse's 0/0 included). If the key changes while you answer, nothing is written. It also warns when the mode cannot be read or is a value it does not know. With two or more keyboards of the same model connected it cannot tell them apart, so it refuses to write (leave only the one to change). `--yes` skips the questions only; the warnings are still printed.

### If something goes wrong

1. **Values written to RAM (profile 0)**: unplug and replug the keyboard; they revert.
2. **Values saved to flash**: press **Undo** while the keyboard is connected. If it was disconnected, plug it back in (press **Connect keyboard** if it does not reconnect by itself) and then press Undo.
   Without an Undo, write the original values back yourself.
   - V3 line: Synapse's default, actuation 1.2 / release 1.1 mm
   - V2 line (V2 Analog, Mini Analog): Synapse stores 0/0 (decided on the PC). The closest this tool can write is actuation 1.62 mm (the firmware default position) with the release field empty; step 3 restores the exact original.
3. Re-apply your profile in **Razer Synapse**, or reset the keyboard's settings there.
4. If it is still wrong, open an [issue](https://github.com/ohy1/SensorFinder-for-Razer-Huntsman/issues). Include the model, firmware version, what you did, the on-screen log and the *raw HID reports*.

### Known limits

- Input on/off is an **estimate** from the loaded points; Rapid Trigger is not modelled.
- While Synapse runs the keyboard does not answer the active-profile query; RAM values are used instead.
- Verified on hardware with the Huntsman V3 Pro 8KHz. Other models follow the protocol notes only, so try RAM first.
- The browser (WebHID) exposes no serial number, so two keyboards of the same model cannot be told apart. With both connected, writes are blocked and **Connect keyboard** keeps only the one you pick. Unplugging one keyboard and plugging in another looks like a replug, which is why Undo asks before writing.
- Starting or quitting Synapse starts or stops the depth stream. The page checks the mode again when you return to its window and when the write tab opens; keys still shown as "input on" are then closed at the time of their last report. Until then the previous state may show.
- If the keyboard the points were read from leaves while another of the same model stays, the page asks you to load them again from the one connected.
- Values written to RAM (profile 0) revert on replug, so they are not put into the saved points. After a reload the saved points are used with a hint to load again.
- A model that is not on the list is monitored only if it sends V3-format (report `0B`) depth data; otherwise the page asks for its raw reports in an issue.

### Reporting security issues

Please use GitHub's **Security → Report a vulnerability** instead of a public issue.
