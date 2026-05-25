# 숫자 야구

브라우저에서 바로 플레이할 수 있는 숫자 야구 게임입니다. 서로 다른 숫자로 이루어진 정답을 제한된 기회 안에 맞히고, Strike/Ball/Out 판정을 보며 다음 추측을 좁혀갑니다.

## Demo

- GitHub Pages: <https://ysoftman.github.io/numberbaseball/>

## Features

- 3자리 또는 4자리 정답 모드
- 0 포함 여부 설정
- 숫자 중복 입력 방지
- 최대 10번의 시도 기회
- Strike, Ball, Out 판정 기록
- 브라우저 `localStorage` 기반 최고 기록 저장
- 숫자 키, `Backspace`, `Enter` 키보드 조작 지원
- 반응형 레이아웃

## How to Play

1. 정답 자리수와 0 포함 여부를 선택합니다.
2. 서로 다른 숫자를 입력한 뒤 제출합니다.
3. 판정을 확인하며 정답을 추리합니다.
4. 모든 자리의 숫자와 위치를 맞히면 성공입니다.

판정 기준은 다음과 같습니다.

- `Strike`: 숫자와 위치가 모두 맞음
- `Ball`: 숫자는 맞지만 위치가 다름
- `Out`: 맞는 숫자가 없음

## Run Locally

별도 빌드 과정이나 패키지 설치가 필요 없습니다.

```bash
open index.html
```

정적 서버로 실행하려면 다음 명령을 사용할 수 있습니다.

```bash
python3 -m http.server 8000
```

이후 브라우저에서 `http://localhost:8000`을 엽니다.

## Project Structure

```text
.
├── index.html
├── script.js
├── styles.css
└── .github/workflows/pages.yml
```

## Deployment

`main` 브랜치에 push하면 GitHub Actions가 정적 파일을 `_site` 디렉터리로 모아 GitHub Pages에 배포합니다.
