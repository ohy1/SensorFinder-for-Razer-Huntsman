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
- **확인된 모델만**: 쓰기는 지원 목록에 있는 모델에만 합니다. 다른 Razer 기기(마우스 등)나 모르는 모델에는 쓰지 않고, 연결한 키보드 하나에만 명령을 보냅니다.
- **모델별 값 범위 검사** (허용 목록에서 한 번 더 검사)
  - 입력 지점: V3 계열 0.1–4.0 mm, V3 Pro Low-profile TKL 8KHz 0.1–2.8 mm(스위치 이동 거리), V2 계열 약 1.62–3.56 mm(펌웨어 범위)
  - 해제 지점: 입력 지점보다 0.1 mm 이상 얕아야 함(V2는 펌웨어 하한도 지킴)
  - 일반 레이어, 프로필 0–6, 알려진 키만 허용
- **읽고-고치고-확인**: 현재 값을 읽어 입력·해제 지점만 바꿔 쓰고, 다시 읽어 확인합니다. 키 기능(fnId)은 그대로 둡니다. 손대지 않은 칸은 읽어 온 값 그대로 씁니다.
- **다른 응답 무시**: 다른 프로그램(Synapse)의 응답이 섞여도 프로필·키·레이어가 맞는 응답만 받습니다.
- **Synapse 경고**: 키보드가 드라이버 모드(Synapse 실행 중)이거나 모드를 알 수 없으면, 쓰기와 되돌리기 전에 확인 창을 띄웁니다.
- **RAM 먼저**: 기본 대상은 RAM(프로필 0)입니다. 플래시 저장은 별도 확인을 거칩니다.
- **결과를 확인하지 못한 쓰기**: 쓴 뒤 확인 읽기에 실패하면 "실패"가 아니라 "확인하지 못함"으로 알리고, 되돌리기를 남겨 둡니다.

웹 화면에만 있는 장치
- **첫 사용 동의**: 처음 쓰기 전에 안전 확인 항목에 동의해야 합니다.
- **되돌리기**: 마지막 쓰기 직전 값으로 복원합니다. 새로고침이나 키보드 재연결 뒤에도 같은 모델이면 남아 있습니다. 되돌리기로 복원할 수 없는 원래 값(이 도구의 범위 밖)이면 쓰기 전에 미리 알립니다.

명령줄 도구(`set-key`)에는 동의 화면과 되돌리기 버튼이 없습니다. 대신 쓰기 전에 원래 값과 **그대로 되돌리는 명령**을 먼저 출력합니다. `--yes`는 질문만 건너뛰고 경고는 계속 출력합니다.

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
- 같은 모델의 키보드 두 대를 동시에 연결하면 브라우저가 둘을 구별하지 못합니다. 쓰기 전에는 한 대만 연결하세요.

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
- **Known models only**: writes are only sent to models on the supported list, never to other Razer devices (mice etc.) or unknown models, and only to the one keyboard that is connected.
- **Per-model range checks** (checked again by the allowlist)
  - Actuation point: 0.1–4.0 mm on the V3 line, 0.1–2.8 mm on the V3 Pro Low-profile TKL 8KHz (switch travel), about 1.62–3.56 mm on the V2 line (firmware range)
  - Release point: at least 0.1 mm shallower than the actuation point (and the V2 firmware floor)
  - Normal layer, profiles 0–6 and known keys only
- **Read-modify-verify**: reads the current value, changes only the two points, reads it back to verify. The key's function (fnId) is kept, and a field left as read is written back exactly.
- **Other replies ignored**: when another program's (Synapse's) replies mix in, only a reply matching the profile, key and layer is accepted.
- **Synapse warning**: if the keyboard is in driver mode (Synapse running) or its mode cannot be read, a confirmation dialog appears before writing or undoing.
- **RAM first**: the default target is RAM (profile 0); saving to flash asks again.
- **Unconfirmed writes**: if the read-back after a write fails, it is reported as "could not confirm", not "failed", and Undo stays available.

Web page only
- **First-use consent**: you must accept the safety notice before the first write.
- **Undo**: restores the values the last write replaced; it survives a reload or replug for the same model. If the original values are outside this tool's range (so Undo could not write them back), you are told before writing.

The command-line `set-key` has no consent screen or Undo button. Instead it prints the original values and a **ready-to-run restore command** before writing. `--yes` skips the questions only; the warnings are still printed.

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
- With two keyboards of the same model connected at once, the browser cannot tell them apart. Connect only one before writing.

### Reporting security issues

Please use GitHub's **Security → Report a vulnerability** instead of a public issue.
