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

- **명시적 조작만**: 사용자가 **적용** 또는 **되돌리기**를 누를 때만 씁니다. 한 번에 키 하나만 씁니다.
- **첫 사용 동의**: 처음 쓰기 전에 안전 확인 항목에 동의해야 합니다.
- **값 범위 검사**
  - 입력 지점: V3 계열 0.1–4.0 mm, V2 계열 1.5–3.6 mm
  - 해제 지점: 입력 지점보다 0.1 mm 이상 얕아야 함
  - 일반 레이어, 프로필 0–6, 알려진 키만 허용
- **읽고-고치고-확인**: 현재 값을 읽어 입력·해제 지점만 바꿔 쓰고, 다시 읽어 확인합니다. 키 기능(fnId)은 그대로 둡니다.
- **다른 응답 무시**: 다른 프로그램(Synapse)의 응답이 섞여도 프로필·키·레이어가 맞는 응답만 받습니다.
- **Synapse 경고**: 키보드가 드라이버 모드(Synapse 실행 중)이면 쓰기 전에 확인 창을 띄웁니다.
- **RAM 먼저**: 기본 대상은 RAM(프로필 0)입니다. 플래시 저장은 별도 확인을 거칩니다.
- **되돌리기**: 마지막 쓰기 직전 값으로 복원하는 버튼이 있습니다.

## 문제가 생겼을 때

1. **키보드를 뽑았다 다시 꽂습니다.** RAM(프로필 0)에 쓴 값은 이것으로 원래대로 돌아갑니다.
2. 플래시에 저장한 값이라면 **되돌리기** 버튼을 누르거나, 도구에서 원래 값(Synapse 기본 1.2 / 1.1 mm 등)을 다시 씁니다.
3. **Razer Synapse**에서 프로필을 다시 적용하거나, 키보드 설정을 초기화합니다.
4. 그래도 이상하면 [이슈](https://github.com/ohy1/SensorFinder-for-Razer-Huntsman/issues)를 남겨 주세요. 모델명, 펌웨어 버전, 한 일, 화면의 로그와 *원시 HID 리포트*를 함께 적어 주시면 됩니다.

## 알려진 한계

- 입력/해제 판정은 읽어 온 지점으로 계산한 **추정**입니다. Rapid Trigger는 반영하지 않습니다.
- Synapse가 실행 중이면 키보드가 활성 프로필 번호에 응답하지 않습니다. 이때는 RAM 값을 사용합니다.
- 실기기 확인은 Huntsman V3 Pro 8KHz에서 했습니다. 다른 모델은 프로토콜 문서 기준이므로 RAM부터 시험하세요.

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

- **Explicit action only**: writes happen only when you press **Apply** or **Undo**, one key at a time.
- **First-use consent**: you must accept the safety notice before the first write.
- **Range checks**
  - Actuation point: 0.1–4.0 mm on the V3 line, 1.5–3.6 mm on the V2 line
  - Release point: at least 0.1 mm shallower than the actuation point
  - Normal layer, profiles 0–6 and known keys only
- **Read-modify-verify**: reads the current value, changes only the two points, reads it back to verify. The key's function (fnId) is kept.
- **Other replies ignored**: when another program's (Synapse's) replies mix in, only a reply matching the profile, key and layer is accepted.
- **Synapse warning**: if the keyboard is in driver mode (Synapse running), a confirmation dialog appears before writing.
- **RAM first**: the default target is RAM (profile 0); saving to flash asks again.
- **Undo**: a button restores the values the last write replaced.

### If something goes wrong

1. **Unplug and replug the keyboard.** Values written to RAM (profile 0) revert.
2. For values saved to flash, press **Undo**, or write the original values back with the tool (for example Synapse's default 1.2 / 1.1 mm).
3. Re-apply your profile in **Razer Synapse**, or reset the keyboard's settings there.
4. If it is still wrong, open an [issue](https://github.com/ohy1/SensorFinder-for-Razer-Huntsman/issues). Include the model, firmware version, what you did, the on-screen log and the *raw HID reports*.

### Known limits

- Input on/off is an **estimate** from the loaded points; Rapid Trigger is not modelled.
- While Synapse runs the keyboard does not answer the active-profile query; RAM values are used instead.
- Verified on hardware with the Huntsman V3 Pro 8KHz. Other models follow the protocol notes only, so try RAM first.

### Reporting security issues

Please use GitHub's **Security → Report a vulnerability** instead of a public issue.
