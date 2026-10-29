# 하루 달력

Windows 10/11용 투명 바탕화면 달력 위젯입니다. Electron 기반이며 로컬 메모와 선택적인 Google Calendar 연동을 제공합니다.

## 기능

- Google Calendar 로그인, 기본 캘린더 일정 조회·등록·수정·삭제, 기존 메모 복사
- 월간 달력, 오늘로 이동, 이전/다음 달 및 키보드 방향키 탐색
- 날짜별 메모, 완료 체크, 네 가지 색상, 삭제 확인
- 배경 불투명도, 월요일 시작 설정
- JSON 백업 내보내기/가져오기 (덮어쓰기 확인)
- 프레임 없는 창 이동·크기 조절, 트레이 숨기기/복원/종료
- 설치된 Windows 앱의 로그인 자동 시작 옵션

## Windows에서 실행

Node.js 22 이상을 설치한 뒤 저장소 폴더에서 실행합니다.

```powershell
npm ci
npm start
```

설치 파일 만들기:

```powershell
npm run dist:win
```

`dist/`에 생성된 설치 프로그램을 실행하세요. 배포용 코드 서명 인증서는 포함되어 있지 않습니다.

## 사용 방법

날짜를 선택하고 오른쪽에 메모를 입력한 뒤 추가하세요. 날짜를 더블클릭하면 입력창으로 이동합니다. 상단을 드래그하면 이동하고 창 가장자리에서 크기를 조절할 수 있습니다. `−` 버튼은 창을 트레이로 숨깁니다. 트레이 아이콘을 더블클릭하거나 메뉴에서 달력을 다시 여세요. 앱 종료는 트레이 메뉴에서 가능합니다.

설정 또는 트레이의 ‘다른 창 뒤로 보내기’는 창을 다른 앱 뒤로 배치합니다. 이 버전은 일반 투명 데스크톱 창입니다. Windows Explorer의 바탕화면 계층(WorkerW)에 영구 부착하는 기능과 Win+D 이후 자동 복원은 구현하지 않았습니다. 바탕화면 아이콘과의 겹침을 피해 창을 배치하세요.

메모와 설정은 Electron 사용자 데이터 폴더의 `calendar.json`에 저장합니다. Windows에서는 일반적으로 `%APPDATA%/desktop-calendar-widget/`입니다. 앱 업데이트/재실행 시 유지됩니다. 로컬 메모는 PC별로 저장되며 Google에 등록한 일정은 다른 PC에서 같은 Google 계정으로 연결해 확인할 수 있습니다. 백업 기능으로 로컬 메모를 별도 보관하세요.

## 개발 및 검증

```sh
npm test
npm run preview
# 다른 터미널에서
node test/smoke.cjs
node test/google-ui-smoke.cjs
```

브라우저 미리보기는 로컬 스토리지를 사용하며 트레이와 창 제어는 Windows 앱에서만 동작합니다. UI 검증은 `CHROMIUM_PATH` 또는 `/usr/bin/chromium`을 사용합니다. Windows 설치·트레이·자동 시작·창 배치는 실제 Windows에서 별도 검증해야 합니다.

실제 메모는 기본적으로 비어 있습니다. 로컬 기능에는 계정이나 API 키가 필요하지 않습니다. Google 기능은 데스크톱 OAuth 클라이언트 설정과 로그인이 필요합니다. [Google Calendar 연결 안내](docs/GOOGLE_CALENDAR.md)를 따르세요.

## 클라우드에서 생성한 실행 패키지

`dist/haru-calendar-google-0.2.0-windows-x64.zip`을 Windows에서 전체 압축 해제한 뒤 `하루 달력.exe`를 실행하세요. 함께 들어 있는 리소스와 DLL을 유지해야 합니다. Windows용 패키징과 ZIP 무결성은 확인했으며, Windows에서의 실제 실행은 아직 검증하지 않았습니다. 이 클라우드 환경에는 Wine이 없어 NSIS 설치 파일 생성은 완료하지 못했습니다. 위 `npm run dist:win` 명령은 Windows에서 실행하세요.
