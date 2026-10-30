# Nanalab QR — 안드로이드 전체화면 웹뷰 앱

https://nanalab.kr/qr 사이트를 **상단 상태바·하단 내비게이션 바 없이 100% 꽉 찬 전체화면(Immersive Mode)**으로 보여주는 안드로이드 앱 프로젝트입니다.

안드로이드 스튜디오가 설치되어 있지 않아도 **GitHub에 업로드(Push)하기만 하면 GitHub Actions가 자동으로 APK 파일을 빌드**해 줍니다.

---

## 주요 기능
- **완전한 전체화면 (Immersive Fullscreen)**: 상단 시간/배터리 상태바 및 하단 소프트키 바 자동 숨김 + 노치(펀치홀) 영역 확장 지원
- **웹 카메라(QR 스캔) 권한 완벽 연동**: 웹페이지에서 카메라(WebRTC) 요청 시 안드로이드 카메라 권한 팝업 자동 연결
- **파일 업로드 & 외부 앱 연동**: 이미지/파일 업로드 선택기(`onShowFileChooser`) 및 `tel:`, `mailto:`, `intent:`, `market:` 스킴 지원
- **뒤로가기 제어**: 웹페이지 내 이전 페이지 이동 지원 + 첫 화면에서 두 번 눌러 앱 종료
- **네트워크 오류 안내 화면**: 오프라인 상태에서 접속 시 깔끔한 다크모드 재시도 화면 제공

---

## GitHub Actions로 APK 빌드하는 방법 (안드로이드 스튜디오 불필요)

### 1단계: GitHub에 새 저장소(Repository) 만들기
1. [GitHub](https://github.com/new)에 접속하여 새 저장소를 생성합니다.

### 2단계: 현재 폴더를 GitHub에 업로드
터미널(PowerShell 또는 명령 프롬프트)에서 현재 폴더(`antigility`) 경로로 이동한 뒤 아래 명령어를 순서대로 실행합니다:

```powershell
git init
git add .
git commit -m "Initial Android WebView app with GitHub Actions"
git branch -M main
git remote add origin https://github.com/<본인아이디>/<저장소이름>.git
git push -u origin main
```

### 3단계: 빌드된 APK 다운로드
1. 본인의 GitHub 저장소 페이지 상단에서 **[Actions]** 탭을 클릭합니다.
2. `Android APK Build (Nanalab QR)` 워크플로우가 자동으로 실행되며, 약 **2~3분** 후 초록색 체크 표시(✅)와 함께 완료됩니다.
3. 완료된 워크플로우를 클릭한 뒤 화면 맨 아래 **Artifacts** 섹션에서 아래 파일 중 하나를 다운로드합니다:
   - **`NanalabQR-debug-apk`** 또는 **`NanalabQR-release-apk`** (압축 해제 후 `.apk` 파일을 스마트폰에 넣어 바로 설치 가능)

---

## 사이트 주소나 앱 이름을 바꾸고 싶을 때
- 접속 주소 및 앱 이름 변경: [`app/src/main/res/values/strings.xml`](app/src/main/res/values/strings.xml) 또는 [`app/src/main/java/kr/nanalab/qr/MainActivity.kt`](app/src/main/java/kr/nanalab/qr/MainActivity.kt)의 `TARGET_URL` 수정

