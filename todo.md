<!-- 1. 모듈 식별자
- .ssc/<이름>.json에 실제 절대 경로 → 하이픈을 뺀 UUID를 기록합니다. 빌드 시작 시 한 번 읽고, 누락된 모듈만 추가하고, 추가했을 때만 저장합니다.
- 초기화 함수 이름(ssc__init_<id>)을 이 id로 바꿉니다.
- 파일 이름은 아직 정하지 않았습니다(후보: identity.json, source-id.json 등). -->
<!--
2. 함수 맹글링 (1에 의존)
- 본문이 있는 함수는 ssc__fn_<id>_<이름>으로 바꿉니다. declare function과 .d.ts의 선언은 그대로 둡니다.
- 호출하는 쪽(같은 파일, 다른 파일, 초기화 함수)의 이름도 같은 규칙으로 바꿉니다.
- cName의 main 예약어는 뺍니다. -->

3. 테스트 snapshot 마스킹 (2 이후)
- 절대 경로, id, 해시를 가려서 기계와 무관한 snapshot으로 만듭니다.
- id는 test/.ssc/id.json으로 고정했습니다 ✅. snapshot의 소스 경로 주석에 절대 경로가 남아 있습니다.
<!--
4. UB 없는 코드 생성 (독립)
- 부동소수 리터럴에 .0을 붙입니다(0 / 0 문제 해결).
- 정수 오버플로 동작을 정의하고(-fwrapv 또는 명시적 검사), 0으로 나누기를 검사합니다.
(더 정확히는 각 숫자 리터럴이 정확한 범위로 표현되게 지원) -->
<!--
5. 경로 누출 방지 (1, 2 이후)
- 링크한 뒤 결과물에 사적 경로가 있으면 빌드를 실패시킵니다.
- 디버그 빌드의 경로 정책은 이 단계에서 정합니다. -->

6. unsafe 추적 (2 이후, 패키지 경계 판정이 필요)
- 패키지 경계 판정, 호출 그래프를 따른 전파, 참조 자리 검사
- ssc:trust, ssc:unsafe, strictStd, allowUnhandledUnsafe

7. 링크 단계 방어 (별도 컴파일을 구현할 때)
- -Wl,--as-needed, 입력 사이의 모듈 id 중복 검사

8. C 연동 다시 설계 (C 백엔드와 함께 지움)
- `ssc:include`, `ssc:link`로 C 헤더와 소스를 함께 빌드하던 기능. C++ 빌드에서는 아직 쓰지 않음
- 헤더의 `__FILE__` 등으로 사적 경로가 결과물에 남는지 검사하던 기능(5와 함께)

~/.ssc 도 있고 전역 설정같은거 적용가능하게.
path.json,  setting.json, config.json 등

[refactor]
1. 소스 파일 가져오기 ✅
2. 노드 분류(로컬) ✅ (prefetch 대상 목록, 지금은 비워 둔 상태)
3. TS 정보 지연 조회 ✅: 노드 메서드(getType, getSymbol, getValueDeclaration, getReturnType)가 필요할 때 checker에 묻습니다. 같은 결과는 클라이언트 캐시가 재사용합니다.
4. TS 연결 유지로 결정: 증분 빌드와 병렬 처리를 위해 API 연결을 닫지 않습니다.
5. 자체 노드 트리 만들기 ✅: TS AST를 순회하며 ssc의 노드(문장, 선언, 식)로 바꿉니다. 이 단계에서 지원하지 않는 문법은 위치와 함께 에러로 걸러냅니다.
6. 이름 연결(binding) ✅: TS 심볼 id를 키로 씁니다.
7. 식의 타입 추론 ✅: 결정 변경. ssc가 직접 계산하지 않고 패치한 TS checker(ssc.go)가 연산 규칙과 타입 불일치를 판정합니다. lower는 TS 결과를 믿지 않고 같은 규칙(common-type.ts)으로 다시 검증합니다.
8. 모듈 그래프: 의존 순서와 초기화 순서는 loadModules가 정합니다 ✅. 순환 import는 허용합니다 ✅. 모듈 사이 TDZ 검사가 남았습니다.
9. 타입 문자열을 `CppType` 노드로 통일: 지금은 변수, 함수 반환, shape 필드가 모두 타입을 문자열(`tsTypeName`)로 들고 `toCppTypeName`으로 바꿉니다. 크기, 정렬, 정리 대상(ref, union) 여부를 lower에서 알아야 할 때(패딩을 줄이는 필드 배치 등) 한 번에 바꿉니다. 지금 크기와 오프셋은 생성 코드의 `sizeof`, `offsetof`로 clang이 계산합니다.
10. 클래스 TDZ: JS 클래스는 호이스팅되지 않아 선언문 실행 전에 쓰면 ReferenceError입니다. 같은 스코프의 직접 사용은 TS가 막고(TS2449), 함수를 거친 사용은 변수처럼 TDZ 분석(tdz.ts)에 넣어 맞춥니다.

┌─────────────────┬──────────────────────────────────────────────────────────────────────────────────────────┐
│      항목       │                                           규칙                                           │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ 반환 타입       │ 여러 return과 조건식은 유니온 유지, C에서는 태그 구조체(타입 id + 8바이트 값)로 표현     │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ 숫자 연산       │ 같은 숫자 타입끼리만 (i32 + i32 → i32). 섞이면 컴파일 에러                               │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ 오버로드        │ ssc가 시그니처를 고르고, 그 시그니처에 적힌 반환 타입을 씀                               │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ 제네릭과 콜백   │ 선언의 모양만 TS에서 가져오고, 타입 인자는 ssc 타입으로 정함                             │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ number          │ JS 숫자. 출력, 비트 연산, 배열 인덱스가 JS와 같음. C++에서는 double 하나를 담는 구조체   │
│                 │ ssc__core__type__number(type_id 34)라 f64와 다른 타입                                    │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ f64             │ 시스템 실수 타입(브랜드). 출력은 정확한 값(정수는 전체 자릿수), 비트 연산은 에러. C 함수 │
│                 │ 선언에는 f64를 씀                                                                        │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ 리터럴          │ 항상 number. 다른 숫자 타입 자리에는 생성자로 (i32(0), f64(0.5))                         │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ 암묵적 변환     │ 없음. 서로 다른 숫자 타입 사이의 대입, 연산, 비교는 컴파일 에러                          │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ 타입 표현       │ number & { readonly [ssc]: '<이름>' } 브랜드. ssc는 prelude 모듈 지역 심볼이라 사용자    │
│                 │ 코드에서 만들 수 없음. 별칭이 아니라 브랜드 타입 리터럴의 심볼로 식별                    │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ char            │ Unicode scalar value(0 ~ 0xD7FF, 0xE000 ~ 0x10FFFF)인 부호 없는 정수 브랜드. u32와       │
│                 │ 같게 처리(C++에서 __UINT32_TYPE__ 별칭)하고 출력은 숫자                                  │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ 문자열          │ string은 JS 문자열(UTF-16, length: number). bstring은 UTF-8이 보장되는 바이트(8비트)     │
│                 │ 단위 문자열(length: u64, 끝 NUL 보장). 서로 다른 타입이고 변환은 생성자로만              │
├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ 생성자          │ number | string을 받음. 리터럴은 컴파일 시점 범위 검사. 손실 없는 변환은 그대로, 손실    │
│                 │ 가능한 변환은 실행 중 정확히 표현되는지 검사 후 RangeError. char()는 실행 중             │
│                 │ ssc__core__fn__char가 검사하고 리터럴은 컴파일 시점에도 검사                             │
└─────────────────┴──────────────────────────────────────────────────────────────────────────────────────────┘

[타입 규칙 전략]
원칙
- JS/TS 의미 호환은 100% 목표가 아님. 성능과 단순함, 컴파일 시간 정확성을 우선하고, 기존 JS 생태계 호환은 나중에
  경계가 분명한 JS 엔진 연동으로 챙김(셀프호스팅 뒤. C 라이브러리 연동이 먼저)
- 다만 흔한 JS 코드는 그대로 동작하게 호환성을 높여 감(로드맵): 리터럴과 number는 JS와 같게 동작, number
  배열 인덱스 지원. 이후 string도 JS처럼 처리하고 바이트 단위로 다루는 메서드를 따로 추가
- TS는 문법, 타입 추론, 좁히기, LSP, 린터 등 생태계를 위해 유지
- fork 패치: 생성자로 대응할 수 있는 편의 기능은 패치하지 않음. 패치는 세 가지
  - 같은 숫자 타입끼리 연산의 결과 타입(i32 + i32 → i32, 섞이면 오류). 순정 TS에서는 산술 결과가 number가 됨(확인).
    리터럴과 number(NumberLike 전체: 숫자 enum 포함)는 number라는 하나의 숫자 종류로 취급. f32, f64 비트 연산과
    부호 없는 타입 단항 -는 오류. 숫자 취급 훅 2개(checkArithmeticOperandType, isTypeAssignableToKindEx)는 삭제
  - 브랜드 숫자 → number(NumberLike, 브랜드 없이 number를 품은 교차 타입 포함) 막기. 대입·subtype·비교 관계
    모두(relater isRelatedToEx). 배열 원소, 객체 속성, union, 제네릭 제약까지 재귀로 막히고 `===`, `as`, switch
    case도 막힘(`1 as i32` 대신 i32(1)). number → 브랜드는 순정 TS가 막음. TS 내부의 "숫자인가" 판정
    (isTypeAssignableTo(x, number 또는 number | bigint))은 입구에서 예외로 통과시켜 산술, 비교, 인덱스는 그대로.
    대상이 교차 타입이면 멤버별 비교는 건너뛰고 교차 타입 전체로 판정(i32 & {}는 통과)
  - bstring + bstring → bstring(string과 섞이면 오류). 문자열 분기보다 먼저 봄
  (932줄 + bstring 976줄)
- 우리 검사 층: 처음에는 TS보다 더 막는 규칙을 컴파일러(lowerValue)에 두기로 했으나, 컴파일러에 의존하면 에디터에서
  보이지 않아 의미가 없음. 막을 거면 fork에서 전부 막고 컴파일러는 정상 코드만 받음(필요하면 나중에 다시 검사).
  TS가 막아서 실행되지 않던 컴파일러 검사(as 리터럴 변환, 숫자 === 타입 검사)는 지움. fork 회귀는 emit 테스트가
  실제 prelude와 빌드한 fork로 정확한 TS 에러 코드(TS2322 등)까지 확인해서 잡음
- scriptc와 대비: scriptc는 JS 호환이 목표라 막지 못하고 복사, 경고, 동적 저장소로 처리함(divergences). 우리는 막음

결정
- 숫자 암시적 넓히기와 관계 기반 대입 제거(fork에서 패치 삭제, 1554 → 867줄). 서로 다른 숫자 타입 사이의 대입,
  연산, 비교는 오류이고 생성자로 명시적 변환(i64(x)). 여유가 생기면 편의 기능 재검토
- 리터럴은 문맥 타입을 따르지 않고 항상 number. 다른 숫자 타입 자리에는 생성자로(const x: i32 = i32(0),
  arr.push(i32(1)), f64(0.5)). char 리터럴도 char('A')
- number와 f64 분리: number는 JS 호환 100%(출력은 ECMAScript Number::toString, 비트 연산은 ToInt32/ToUint32,
  배열 인덱스), f64는 우리가 정하는 정확한 표현(출력은 std::to_chars 기본, 2^63 → 9223372036854775808, 비트 연산
  오류). f64는 다시 브랜드. 둘은 서로 손실 없는 변환(number(x), f64(n))이지만 다른 타입이라 섞으면 오류.
  C++에서 number는 double 하나를 담는 구조체(type_id 34, 연산자는 멤버, 비교는 == 와 <=> 기본 구현). 같은 C++
  타입이면 type_id와 오버로드로 구분할 수 없어서(배열 원소 출력, union 태그) 별도 타입으로 둠. -O1부터 double과
  같은 기계어(직접 비교함). C 함수 선언에는 f64를 씀
- 생성자는 number | string을 받음. 리터럴 인자는 컴파일러가 범위 검사(i32(300)이 i8이면 오류), 다른 숫자 타입은
  손실 없는 변환만 허용. 문자열 리터럴은 bignumber.js로 파싱(u64('18446744073709551615'), '0xff', '1e3')
- 정수 표기 리터럴이 f64로 정확하지 않거나(2^53 초과) 리터럴이 무한대가 되면 컴파일 오류, 문자열 생성자를 안내
- ===/!== 에서 숫자 타입이 다르면 오류(리터럴, number, union 멤버 포함). 브랜드끼리는 TS가, number와 섞인 경우는
  컴파일러가 막음. "타입이 다르면 항상 false"는 count === 0 같은 비교가 조용히 거짓이 되어 채택하지 않음
- 배열 인덱스 타입은 number로 열어 둠(나머지 매개변수 원소 타입을 TS가 number 리터럴 인덱싱으로 구해서 u64만
  있으면 검사가 꺼짐, relater.go tryGetTypeAtPosition). 컴파일러는 u64와 number만 허용. 0 이상 정수 리터럴은 u64로,
  number는 실행 중 정수이고 0 이상인지 확인(아니면 -1로 범위 밖). 읽기는 undefined(JS와 같음), 쓰기는 RangeError
  (JS는 속성을 조용히 만듦)
- number 비트 연산과 시프트는 JS와 같게 허용(ToInt32/ToUint32, 시프트 수는 & 31). prelude의
  ssc__core__fn__number_to_i32/number_to_u32로 변환. 실제로 쓸 때만 비용이 듦. f32, f64는 오류
- char는 브랜드로 남기되 부호 없는 정수 그룹(SscUnsignedIntegerType)에 넣고 u32와 같게 처리. C++에서는
  ssc__core__type__char = __UINT32_TYPE__ 별칭이라 char 전용 분기가 없음. 출력과 문자열 이어 붙이기에서 숫자로 나옴
  ('a' + char('A') → 'a65'). u32 ↔ char는 다른 숫자 타입처럼 생성자로 변환
- char 생성자: 생성 코드는 항상 실행 중 ssc__core__fn__char 호출이고 검사 규칙은 prelude 한 곳(is_code_point).
  문자열은 UTF-8에서 코드 포인트 하나를 꺼낸 뒤 숫자와 같은 범위 검사(정수, 0 ~ 0x10FFFF, 서로게이트 제외),
  실패하면 RangeError: Invalid code point. 다른 숫자 리터럴처럼 리터럴 타입 인자는 컴파일러도
  parseSafeCodePoint로 검사해 컴파일 오류(`0xd800 is an invalid code point`)
- 생성자: 손실 없는 변환은 그대로 cast, 손실 가능한 변환은 실행 중 값이 정확히 표현되는지 검사 후 RangeError
  (`3.7 can not be converted to i32`). 소수가 있는 실수 → 정수도 오류(잘라 쓰려면 사용자가 직접 자름). Swift
  Int32(x)와 같은 방식
- 컴파일러의 공통 타입 계산(commonType)은 지움. 같은 타입끼리만 연산하므로 양쪽 피연산자 타입이 같은지만 확인
- 공유 컨테이너(배열 원소, 객체 속성)의 칸 표현이 바뀌는 대입은 컴파일 오류(i32[] → (i32 | string)[],
  { x: i32 } → { x?: i32 }). 복사하면 === 와 변경 공유가 조용히 달라져서 막음. 필요하면 사용자가 명시적으로 복사
  (ints.map((x) => x), { x: p.x }). 오류 메시지에 해결 방법을 보여 줌. 새로 만든 리터럴은 예외(처음부터 대상 타입)
- 순정 TS로는 배열을 불변 변성으로 못 만듦: tsgo relater.go getVariances가 Array, ReadonlyArray, 튜플을 공변으로
  고정해서 `interface Array<in out T>`가 무시됨(확인). 배열 엄격 변성 옵션도 없음(microsoft/TypeScript#58607)

남은 고민
- 복합 대입(a += b)은 지금 a = a + b로 내림(대상이 변수뿐이라 같음). 속성, 원소 대상을 지원할 때 C++ op= 로 내려
  대상을 한 번만 평가(number 구조체에는 op= 연산자가 이미 있음)
- console.log(-0)은 node에서 -0이지만 지금은 0(to_string과 inspect가 같은 함수). JS 호환 100%면 inspect에서 구분
- prelude의 requires type_id 범위 조건(숫자 17~24, 32~34)이 풀어 쓰여 있음. C++20 concept
  (ssc__core__concept__number 등)로 이름을 붙여 정리(보류)
- union끼리 넓히기((i32 | string)[] → (i32 | string | undefined)[]): 메모리는 안전(union 칸 공유, 잘못 읽으면
  TypeError)하지만 넓힌 쪽으로 쓰면 좁은 쪽 타입이 깨짐(TS 자체의 배열 공변 구멍). 쓰기 가능 컨테이너는 불변 변성,
  읽기 전용만 공변으로 할지 검토(Kotlin MutableList/List, Rust, C#)
- 구조적 타이핑(속성이 더 많은 객체 대입): 후보는 shape 검사 + 이름으로 찾기(측정상 같은 모양이면 0.46 대 0.48ns),
  관계없는 타입 사이 대입 금지 + extends만 허용(부모 필드를 앞에), 대입 시 복사(=== 와 변경 공유가 달라짐)
- 장기: 셀프호스팅 뒤 TS 파서(oxc, tsgo)는 그대로 두고 타입 검사기와 LSP를 직접 만드는 방안. 우리 문법의 부분집합만
  다루면 됨. 그때까지의 결정이 타입 시스템 명세 초안이 됨

[다음 작업 순서]
1. 메모리 할당 ✅ (prelude/arena.h, arena.c) → 객체별 RC로 전환하며 대체됨
2. 문자열
3. 아레나 스코프 관리 → 객체별 RC로 전환하며 필요 없어짐

[문자열]
- 두 타입으로 나눔(number와 f64처럼). JS 코드는 string, 저수준 작업은 bstring
  - string: JS 문자열. `{header, length, u16 units[]}`(UTF-16). length는 UTF-16 단위 수(number), 대소 비교는 UTF-16
    코드 유닛 순서(JS와 같음), 짝 없는 서로게이트도 담음. 메모리가 문제가 되면 V8처럼 1바이트/2바이트 이중 표현
  - bstring: UTF-8이 보장되는 바이트(8비트) 단위 문자열. `{header, length, bytes..., NUL}`. length는 바이트 수(u64),
    끝 NUL 보장이라 C에 복사 없이 넘김. Rust String처럼 불변이고 입력 경계(생성자)에서만 O(n) 검증, 리터럴과
    이어 붙이기는 비용 없음, 위치를 받는 연산(slice 등)은 문자 경계를 O(1)로 검사. Go처럼 보장 없는 방식은 안전성
    때문에 채택하지 않음. 이름은 cstring(C 문자열은 길이가 없음), u8string(C++ u8string은 검증하지 않음) 대신 bstring
  - bstring은 string과 교차하지 않는 별도 인터페이스. 교차 브랜드로 하면 String 메소드가 오버로드로 섞이고
    (bstring 메소드에 string이 들어감) bstring → string 대입도 열려서 막을 패치가 둘 더 필요함. 별도 타입이면 서로
    대입·비교가 TS 기본 규칙으로 막히고, fork 패치는 `+`(bstring + bstring → bstring, string과 섞이면 오류) 하나
  - 메소드 시그니처는 `SscString<S, I>` 하나로 공유(`String extends SscString<string, number>`,
    `bstring extends SscString<bstring, u64>`). 전역 String은 제네릭으로 선언할 수 없음(TS2317)
- 변환: `bstring(string | bstring | u8[])`, `string(string | bstring | u8[] | u16[])`. 짝 없는 서로게이트를
  UTF-8로 바꾸거나 잘못된 UTF-8을 읽으면 RangeError. 문자열 리터럴 인자는 컴파일 시점에 변환하고 검사
- `bytes(): u8[]`(복사). string은 짝 없는 서로게이트면 RangeError(bytes()는 JS에 없는 메소드라 안전한 쪽).
  U+FFFD로 바꾸려면 `toWellFormed().bytes()`로 명시(toWellFormed는 메소드를 늘릴 때 추가)
- 출력(`process.stdout.write`, console.log)은 두 타입 모두 받음. bstring은 바이트 그대로, string은 UTF-8로 인코딩
  (출력 경로는 짝 없는 서로게이트를 U+FFFD로, node와 같음). 함수 하나에서 서술자로 분기해 union도 처리
- 컴파일러는 문자열 리터럴 값을 AST 노드에서만 읽음(getStringLiteralValue). tsgo 체커가 넘기는 리터럴 타입 값은
  짝 없는 서로게이트가 U+FFFD로 바뀌어 옴
- `str + c`(char)는 다른 숫자처럼 숫자로 이어 붙음(char는 u32와 같게 처리)
- 보류: typeof bstring(정수 타입과 함께 정함), 단항 `+bstring`(나중에 숫자 변환으로 지원 가능), bstring의
  inspect 표시(지금은 string과 같은 'abc'), 인덱싱(`s[i]`, charCodeAt), for...of와 iterator, bytes()를 복사 대신
  뷰나 iterator로, 여러 바이트를 묶어 읽는 view API(u16/u32/u64, 엔디언 지정)
(아래는 아레나 시절의 bstring 메모리 메모. 메모리 모델을 객체별 RC로 바꿨으므로 근거는 다시 봐야 함. 특히
StringView를 따로 둔 이유인 "원본 아레나 전체를 붙잡는 누수"는 RC에서는 원본 문자열 하나만 붙잡는 문제로 바뀜)
- 메모리 표현: `{length, bytes..., NUL}`을 가리키는 8바이트 포인터
  - 다른 참조와 같은 8바이트라 union 값 칸, write barrier, 아레나 RC를 그대로 씀
  - 항상 NUL로 끝나 C에 바이트 시작 위치를 그대로 넘김
  - 리터럴은 static const 데이터
  - 부분 문자열은 결과가 놓일 아레나에 복사함. 원본을 공유하면 아레나 사이 참조가 생겨 원본 아레나
    전체가 살아남음(반복문 아레나는 rollback도 못 함)
  - 복사 없는 부분 참조는 `str.view(start, end): StringView`로 명시적으로 만듦. StringView는 `{ptr, len}`
    16바이트 값이고 원본 아레나를 참조함. 기본을 복사로 둔 이유: 잘못 쓰면 1번(복사 기본)은 복사 비용,
    2번(참조 기본)은 아레나 전체를 붙잡는 누수라 찾기 어려움. C++(substr + string_view), Java와 같은 쪽
  - StringView의 멤버, string으로 되돌리는 방법(복사), 인자 형태는 아직 정하지 않음
- 리터럴 TU 간 병합(최적화): 지금은 모듈 안에서만 같은 값을 한 번 만듦. 필요하면 `-fmerge-all-constants`로
  링크 시점에 합침. 문자열은 주소가 아니라 내용으로 비교하므로 C의 "다른 객체는 다른 주소" 규칙을 어겨도 됨
  - 탈출하지 않는 부분 문자열은 컴파일러가 내부적으로 `{ptr, len}` 뷰로 복사를 생략할 수 있음(최적화)
  - `s += x`에서 s가 아레나의 마지막 할당이면 bump를 늘려 제자리에서 이어 붙일 수 있음(최적화)
  - 채택하지 않음: `{ptr, len}` 16바이트 값(Go, Zig, Rust &str 방식). 부분 문자열은 복사가 없지만 원본
    아레나를 붙잡고, union 8바이트와 맞지 않고, NUL 종료가 보장되지 않음

[배열]
- 배열은 RC 객체(`ref`, union `type_id` 48). JS 배열은 참조로 공유되므로(`const b = a; b.push(1)`) 값 타입이 아님
- 메모리 표현: `header(16) | length(8) | capacity(8) | elements*(8)`, 40바이트
  - 원소는 배열 객체 하나만 소유하는 별도 malloc 버퍼(RC 없음). 문자열처럼 객체 뒤에 붙이면 커질 때 객체가
    재할당되어 주소가 바뀌고 다른 `ref`가 무효가 됨. V8(JSArray + FixedArray), Java ArrayList와 같은 구조.
    Swift Array는 원소를 붙이지만 값 타입(COW)이라 가능함
  - 용량이 차면 2배(Rust Vec과 같음. Go 2배→1.25배, Java 1.5배, V8 1.5배+16)
  - `ref`, union 원소는 포인터 하나만 들고 있어 `realloc`으로 옮겨도 됨(trivial_abi)
- 원소 shape별 C++ 템플릿 `ssc__core__struct__array<Element>`: i8~u64, f32, f64, boolean, char, ref, union.
  shape stenciling이라 인스턴스 수가 이 이상 늘지 않음
- 해제: 서술자의 배열 전용 소멸 함수가 원소의 RC를 내리고 버퍼를 `free`
- 읽기 `a[i]`: `T | undefined`(`noUncheckedIndexedAccess` 강제). 범위 밖이면 `undefined`
- 쓰기 `a[i] = x`: `0 <= i < length`만 허용, 그 밖은 `RangeError`. `i === length`도 오류(끝에 추가는 `push`로만).
  JS는 길이를 늘리고 빈칸(hole)을 만들지만 `Array<i32>`는 빈칸을 표현할 수 없음. Rust, Go, Swift, Java도 오류
- API의 숫자 타입은 JS와 같은 number(length, push 반환, 콜백 인덱스, indexOf). C++ 저장은 u64 길이 그대로이고
  꺼낼 때 number로 바꿈. 인덱스는 u64와 number(실행 중 정수·범위 확인). 시스템용 배열(BArray 등, length: u64)은
  필요해지면 SscString처럼 공통 제네릭 인터페이스로 추가
- 첫 단계: `T[]` 타입, 리터럴, `length`, 인덱스 읽기·쓰기, `push`, `pop`, `console.log` 출력
- 콜백 메서드(`forEach`, `map`, `filter`, `reduce`, `find`, `some`, `every`, `indexOf`)는 지금 prelude C++로 구현.
  제네릭이 생기면 TS 표준 라이브러리로 옮김. C++에는 할당, `length`, 원소 읽기·쓰기, `push`/`pop`, `call` 같은
  기본 연산만 남김
- 나중: `length` 대입(잘라내기), `new Array(n)`

[예외]
- `throw`는 아무 값이나 던짐(JS와 같음). C++에서는 `ssc__core__type__union`을 그대로 throw. C++ 예외는 정상 경로 비용이
  0(테이블 기반 unwinding)이고, unwinding 중 ref/union 소멸자가 RC를 내려 메모리도 안전함
- `catch (e)`의 e는 TS에서 unknown, C++에서는 union 지역 변수(unknown 타입은 union으로 내림). `catch {}`도 지원
- prelude의 실행 중 에러(RangeError, TypeError, ReferenceError)는 지금 `"RangeError: ..."` 메시지를 JS string 값으로
  던짐(throw_message). 잡으면 e가 그 문자열
- 잡히지 않은 예외: main이 union으로 받아 stderr에 console.error와 같은 형식으로 쓰고 종료 코드 1. node 출력의 값 줄과
  같음(문자열은 따옴표 없이, 객체는 `{ a: 1 }`). 소스 위치, 스택 프레임, node 안내 문구는 낼 수 없음
- 나중
  - Error 객체(Error, RangeError, TypeError, ReferenceError, name/message), `new`, `instanceof`는 클래스와 함께 구현.
    그때 prelude 에러도 Error 객체로 던짐
  - `finally`는 지금 컴파일 에러(`not implemented finally`). JS와 같게 하려면 완료 기록 방식: try/catch 안의 return,
    break, continue를 "어떻게 빠져나가는지 기록 + goto finally"로 바꾸고, 예외는 catch (...)로 받아 finally 뒤에 다시
    던짐. finally 안의 return이 원래 반환값이나 예외를 덮어쓰는 것까지 같아짐. 소멸자 가드 방식은 finally에서
    return/break를 할 수 없고 unwinding 중 예외면 std::terminate라 채택하지 않음

[메모리 모델]
기본: 객체별 참조 카운트(RC) + RAII (아레나 모델을 대체함)
- 할당과 해제는 컴파일러가 자동으로 넣음. 사용자에게 노출하지 않음
- 참조 타입은 RC 핸들 클래스로 내림. 복사 생성자 = +1, 소멸자 = -1(0이면 해제),
  이동 생성자 = 증감 없이 소유권만 넘김(마지막 사용에서 RC 연산 생략)
- 같은 계열: Swift ARC, Nim ARC, Koka Perceus
- 객체 헤더에 RC 8바이트
- 멀티스레드에서는 원자 연산 비용이 생김(biased RC 검토)

전환 이유
- C++의 복사·이동·소멸자가 RC 규칙과 1:1로 맞아 lower가 단순해짐
- 아레나 모델은 탈출 분석, write barrier, 아레나 풀, 주소 → 아레나 테이블이 필요해 복잡함
- 성능 차이 측정(glibc malloc, -O2, 16~24바이트 객체 1천만 개): bump 아레나 3.7ns,
  malloc + RC 증감 + free 6.6ns, malloc 전부 → free 전부 10.9ns(객체당).
  2~3배 차이지만 절대값은 객체당 3~7ns라 할당이 지배적인 프로그램이 아니면 작음
- 할당이 많은 경우는 할당기 교체(크기별 풀, mimalloc 방식)와 명시적 아레나 API로 보완

스택과 힙
- 전체 프로그램 정적 탈출 분석으로 스택에 둘지 힙에 둘지 정함
- 콜백과 함수 값도 재귀적으로 분석함. 외부 C 호출은 보수적으로 탈출한 것으로 봄
- 스택 객체도 첫 필드가 오브젝트 헤더이고 RC를 0(불멸)으로 둠. union, 복사, 이동에서 RC 연산이 무시되어
  힙 객체와 같은 코드로 다룸. 해제는 범위가 끝날 때 스택에서 일어남
- union에 담긴 값도 추적함. union이 탈출하면 담긴 객체도 탈출한 것으로 보고 힙에 둠(Go의 interface와 같음)

순환
- 우선순위 낮음. 셀프호스팅까지는 순환이 누수됨(컴파일러는 짧게 끝나는 프로세스라 문제없음)
- 나중에 순환 수집기 추가: Nim ORC 방식. RC가 줄었지만 0이 아닌 객체를 후보로 모았다가
  trial deletion(Bacon–Rajan)으로 순환만 해제. 순환이 불가능한 타입은 후보에서 제외
- 사용자에게 weak 표시를 요구하지 않음(JS의 일반 참조는 모두 강한 참조)

참조
- 8바이트 포인터. 세대(generation) 검사 없음

명시적 아레나 API (선택 기능, 나중에)
- 할당이 많은 코드만 프렐류드의 아레나 객체나 함수로 대량 할당·일괄 해제
- 안전성 방식은 그때 정함: 아레나 자체에 RC(밖에서 가리키면 해제를 미룸), 해제 시점 검사 후 예외,
  콜백 안에서만 쓰게 해서 탈출을 컴파일러가 막기
- Go의 arena 실험은 use-after-free 문제로 보류됨. Zig, Rust bumpalo, C++ pmr은 사용자 책임

채택하지 않은 방식
- 기본 모델로서의 아레나 + 아레나 단위 RC (C 백엔드 때의 설계. prelude/arena.h, arena.c)
- destination passing (이전 프로젝트의 결정은 반영하지 않음)
- 세대 검사용 fat pointer, tagged pointer
- 격리(quarantine) + GC
- 값 단위 수동 해제를 사용자에게 노출, ID 집합

[객체 표현]
객체 헤더
- rc 8바이트 + 서술자 포인터 8바이트 = 16바이트(CPython, Swift와 같은 수준. Rust는 헤더 0, `Rc`는 16)
- 모든 참조의 첫 8바이트가 rc라서 RC 처리는 실제 타입을 몰라도 됨
- 문자열을 포함한 모든 참조가 이 헤더를 가짐. 문자열은 헤더 뒤에 length, bytes(V8, CPython과 같음)
  - TS는 문자열을 `{ length: number }` 같은 구조적 타입 자리에 넣을 수 있어 서술자와 shape가 필요함
  - `typeof x === 'string'`은 서술자의 종류로 판별. union에 문자열 전용 id가 필요 없음
  - 정적으로 string 타입인 곳의 메서드 호출은 서술자 없이 직접 호출

shape
- 객체 리터럴: (이름, 타입)을 정렬한 목록으로 레이아웃을 정함. TS 구조적 타입은 필드 순서를 보지 않음
- 클래스: 부모 클래스의 레이아웃을 그대로 앞에 두고 자기 필드를 뒤에 붙임(상속 레이아웃, C++, Java, C#, Swift와 같음).
  그래서 부모 타입으로 자식 객체의 부모 필드를 읽으면 자식이 몇 종이든 정적 오프셋
- 같은 shape는 오프셋 표를 공유
- 정리 목록(ref 필드 오프셋, union 필드 오프셋)은 레이아웃에서 나오므로 shape가 가짐. 서술자 N개가 shape 하나를 공유
- 나중에 필드 정보(이름, 오프셋, 종류)를 추가. 이름은 TS의 원래 이름을 정적 바이트 + 길이(span)로 담음.
  첫 소비자(구조적 타입 접근, `JSON.stringify` 등)와 함께 추가

서술자
- (shape, 키 순서) 조합마다 하나. 객체는 서술자 포인터만 가짐. 서술자는 shape를 가리킴
- 키 순서: JS는 열거·직렬화(`Object.keys`, `for...in`, 스프레드, `JSON.stringify`)에서 삽입 순서를 드러냄
  (정수 키는 오름차순으로 앞). `{ a, b }`와 `{ b, a }`는 shape는 같고 서술자는 다름
- class는 필드 선언 순서가 고정이라 클래스당 서술자 하나. 클래스 표를 겸함(`instanceof`, 메서드 등)
- plain object의 서술자는 클래스가 없음(익명)
- V8의 Map(hidden class)과 같은 구조. 다른 점은 TS가 속성 추가를 막아 실행 중에 shape가 바뀌지 않는 것

필드 접근
- 접근 위치마다 컴파일러가 둘 중 하나를 냄(실행 중에 단계를 거치거나 대체 경로로 가지 않음)
  - 정적 읽기 `*(obj + 상수)`: shape가 같거나, 클래스 타입 수신자이고 필드가 그 클래스나 부모에 선언된 경우(상속 레이아웃
    덕분에 자식이 몇 종이든 같은 오프셋). 프로그램 전체를 볼 필요 없음
  - 해시 읽기 `*(obj + desc->offsets[(H >> desc->shift) & desc->mask])`: 그 밖의 구조적 접근(필드가 더 많은 객체,
    관계없는 클래스, 인터페이스). H는 필드 이름의 FNV-1a 64비트 해시(컴파일 시점 상수, 모듈을 따로 컴파일해도 같음).
    서술자마다 자기 필드가 겹치지 않는 shift/mask를 컴파일 시점에 고름(완전 해시). 겹치는 해시는 컴파일 에러. 분기가
    없어 shape 종류 수와 순서에 관계없이 비용이 일정함(최악의 경우가 없음)
  - 인라인 캐시는 쓰지 않음. 1종일 때만 조금 빠르고 5종 이상(캐시 칸 초과)이나 무작위 순서에서 3~13배로 무너짐.
    "캐시 확인 → 해시" 조합도 캐시 비교 분기의 예측 실패로 오히려 느림
  - 지금 구현(ssc__core__fn__field: shape id 비교 → strcmp 선형 검색)은 클래스 작업에서 위 방식으로 바꿈
- 메소드: 클래스 계층의 재정의 메소드는 vtable(자식이 5종 이상이면 이름 기반 캐시보다 약 2배 빠르고 자식 수와 무관),
  구조적 타입의 메소드 호출은 서술자의 메소드 해시 표. 무작위 순서의 간접 호출 예측 실패(4~9ns)는 어떤 방식도 같음
- 동적 경로 비용 측정(2026-11-02, Ryzen 9 9950X, -O2, 객체 4096개 포인터 배열에서 i64 필드 합, ns/접근)
  - 직접 접근: C/C++/Rust 0.18, Go 0.19, syscript 정적 경로 0.26(헤더 16바이트로 객체가 커져 캐시 줄을 더 씀.
    명령어는 같음)
  - syscript 동적: 단형 캐시 적중 0.27(정적의 약 1.05배), 다형 캐시 2종 예측 가능 0.33~0.37(1.3~1.6배), 2종 무작위
    예측 불가(26만 개) 3.0~3.6(8~10배), 캐시 없이 매번 검색 0.91~1.05(약 4배)
  - 비교: C 함수 포인터 0.94~1.07, C++ virtual 1.00~1.07(2종 무작위 4.15), Rust dyn 1.07, Go interface 0.73~1.08,
    V8 인라인 캐시 shape 1/2/4/8종 0.47/0.53/0.70/2.02
  - 측정 함정: 무작위 순서를 매번 반복하면 분기 예측기가 순서를 외워 결과가 코드 배치에 따라 갈림(4096개에서
    -O1 0.41, -O2 1.43). 외울 수 없는 크기로 재야 최악값이 나옴
- 레이아웃 방식 비교(2026-11-04, 같은 조건, 부모 타입 배열에서 부모 필드 읽기, 필드 6~8개 객체)
  - 자식 shape 1~64종, 반복/무작위 순서: 상속 레이아웃 0.31~0.65 일정, 4칸 캐시 0.35~7.94(5종 이상 1.7~2.0, 무작위
    최대 7.94), 완전 해시 0.64~0.86 일정, virtual getter 1.03~1.16(무작위 4.6~7.2)
  - 접근 패턴별 상속 레이아웃 대비 완전 해시: L1 필드 읽기 4.5~4.7배, L2 2.1배, L3 1.5배, 메모리 1.03~1.18배.
    연결 리스트 따라가기(트리, AST 순회 모양)는 걸음마다 약 3ns 추가로 L1/L2에서 2.4~4.9배
  - 프로그램 단위(RC 증감, 재귀, 분기 포함, 1천~133만 노드): 식 트리 평가(부모 필드 1개/노드) 완전 해시가 1.17~1.31배,
    AST 방문(부모 필드 3개/노드) 1.25~1.49배 느림. 실제 패스는 노드마다 일이 더 많아 비율이 작을 것으로 예상
  - 결론: 상속 레이아웃 + 정적 읽기 + 완전 해시. 공수는 완전 해시만 쓰는 것과 같거나 적음(정적 판정이 "선언된 계층의
    필드인가"만 보면 됨. 완전 해시만 쓰면 클래스 타입 접근을 정적으로 하려고 자식 클래스가 없는지 프로그램 전체를 봐야 함)
  - 벤치 코드: tmp/object-layout(git에 올리지 않음). syscript_model.cpp, megamorphic.cpp, hierarchy.cpp, layout.cpp,
    program.cpp, plain.c, plain.cpp, rust, go, v8.js. 클래스를 구현한 뒤 생성 코드가 이 가정대로 나오는지 다시 잼
- `private`/`protected` 멤버가 있는 클래스는 명목적으로 비교되어 plain object가 들어오지 않음

실행 중에 정해지는 서술자
- 스프레드(`{ ...a, ...b }`)는 입력의 실제 키 순서를 따름. 입력 서술자 조합별로 만들어 캐시(V8의 transition과 같음)

프렐류드 반영
- `ssc__core__struct__object_header`: rc + 서술자 포인터 (16바이트)
- `ssc__core__struct__descriptor`: shape 포인터 (8바이트)
- `ssc__core__struct__shape`: ref 필드 오프셋 span, union 필드 오프셋 span (32바이트)
- `ssc__core__struct__span<Type>`: 길이 + 원소 포인터. 정적 배열을 길이와 함께 가리킴(`std::span`과 같은 구조).
  프렐류드 내부의 몇 가지 원소 타입에만 써서 템플릿으로 둠
- `drop_rc`: RC가 0이 되면 shape의 두 목록을 돌며 각 위치의 `~ref()`, `~union()`을 호출(하위 참조로 전파)한 뒤 `free`.
  범용 함수 하나라 클래스마다 소멸 함수를 만들지 않음(Go, Java GC의 포인터 지도와 같은 방식)
  - 클래스별 소멸 함수와 비교(ref 3, union 1, 숫자 2 필드 객체 500만 개 해제, free 포함): 클래스별 5.1~5.6ns,
    범용 ref/union 목록 5.9~6.0ns, 범용 전체 필드 + 종류 분기 7.5ns, 목록 하나 + 항목마다 종류 분기 6.7~7.1ns
  - 정리가 재귀라 아주 긴 연결 리스트를 해제하면 스택이 넘칠 수 있음(Rust `Box` 리스트와 같은 문제)
- 모든 객체는 서술자를 가져야 함(`drop_rc`가 null 확인 없이 따라감). 문자열 서술자는 문자열 생성 함수를 만들 때 위치를 정함
- 대입 연산자(ref, union의 복사·이동)는 `other`의 값을 `drop_rc` 전에 꺼내 둠. `other`가 왼쪽 객체 안의 필드면
  (`node = node.next`) 왼쪽 해제와 함께 사라지기 때문. 이 순서로 자기 대입도 분기 없이 안전함
- 이동된 union의 `type_id`는 0(uninitialized). undefined는 정상 값이라 실수로 쓰면 버그가 숨음
- union 템플릿 생성자는 `requires(type_id<Type> != 0)`로 등록된 프렐류드 타입만 받음(16바이트 구조체를 8바이트 칸에
  복사하는 버그 방지)
- `ssc__core__type__ref`: 런타임의 논리적 참조(RC 관리). 내부에 C++ 포인터(`object_header *`) 하나를 담고 템플릿이 없음.
  템플릿이면 클래스마다 인스턴스가 생겨 컴파일 +52%, -O0 크기 2.5배(클래스 5,000개 측정, -O1 이상 결과물은 같음)
- union `type_id`는 참조 타입 전체가 48(ref) 하나. 실제 종류는 서술자가 앎
- 필드 접근은 생성 코드가 `object_header *`를 실제 구조체로 캐스트

미정
- 내장 컨테이너(Array, Map, Set): 원소 수가 실행 중에 정해져 정적 목록으로 정리할 수 없음. 서술자에 내장 타입 전용
  소멸 함수(null 가능)를 두고 std 컨테이너 소멸자에 정리를 맡기는 방향. 원소 shape별로 몇 개만 생김
- 힙 객체 생성: placement new 없이 `ref` 필드를 가진 객체를 만드는 방법(테스트는 `__builtin_memcpy`로 만듦)

[클래스]
1단계(상속 없음) ✅ 2026-11-06
- 클래스 하나 = C++ 네임스페이스 `ssc__ts__class__<이름>`. 구조체(shape), descriptor(클래스 이름 포함), 생성자, 메소드가 모두 그 안에 있음.
  C++ class를 쓰지 않는 이유: vptr이 객체 헤더(descriptor)와 겹치고 offsetof를 못 씀, 부모 생성자 안의 가상 호출 의미가 JS와 다름,
  구조적 타입(같은 모양의 plain object)에 메소드 호출을 못 함
- 필드 순서는 선언 순서. 초기값 없는 필드는 `allocate_object`가 기본값(숫자 0, ref null, union undefined)으로 채움
- `new C(a)` → `C::constructor(allocate_object(sizeof, &C::descriptor), a)`. 할당은 `new` 자리에서 하고 생성자는 `this`를 받아
  필드 초기값 → 본문 → `this` 반환. `super()`도 부모 생성자에 같은 `this`를 넘기면 됨(JS의 new.target과 같은 결과)
- 메소드는 `this`를 첫 인자로 받는 함수. 화살표 함수의 `this`는 클로저 캡처(ref)
- 다른 파일의 클래스는 쓰는 곳에서 클래스 블록을 forward로 다시 냄
- 막아 둔 것(컴파일 에러): extends, abstract, static, 접근자, `#private`, 파라미터 프로퍼티, 지역 클래스, 생성자 반환값,
  메소드를 값으로 꺼내기, `declare class`

2단계(상속) ✅ 2026-11-06
- 구조체는 부모 필드 → 자기 필드 순서. `super(...)` 자리에서 부모 생성자 호출 → 자기 필드 초기값. 생성자가 없으면 인자를 그대로 넘김
- `super.m()`은 부모 쪽 구현을 직접 호출. `instanceof`는 descriptor의 부모 포인터 체인
- 재정의 메소드의 C++ 시그니처가 부모와 다르면 아직 컴파일 에러(함수 값 어댑터로 풀 수 있음)

메소드 호출 = key → 값 조회 + 호출 (2026-11-06 결정)
- JS의 메소드는 값이 함수인 속성일 뿐(프로토타입에 있느냐, 객체에 있느냐 차이). 호출하는 쪽은 메소드와 함수 필드를 구분하지 않음
- descriptor마다 key → 값 위치 완전 해시 표 하나(`ssc__core__struct__member`): 필드는 객체 안 오프셋, 메소드는 클래스 쪽 정적 함수 값
  (`ssc__ts__value__<이름>`). 상속받은 메소드와 재정의는 클래스를 만들 때 표에 확정
- `obj.m(a)` → `ssc__core__fn__call<R, A>(member<ref>(obj, H), obj, a)`. 인스턴스 여부, 상속, 정적 타입과 무관. plain object를 클래스
  타입으로 받거나 클래스 인스턴스를 구조적 타입으로 받아도 같은 경로
- 처음 구현(정적 타입 클래스의 vtable 직접 호출)은 plain object가 들어오면 잘못된 메모리를 호출해서 버림
- 함수 값 호출 규약 통일: `R (*)(const closure*, ref this, A...)`. 인자는 정적 함수 타입을 lower한 타입 그대로(union 배열 폐기).
  화살표/함수 식은 놓인 자리의 기대 타입 시그니처로 만들고, 시그니처가 다른 함수 타입 자리에 기존 함수 값을 넣을 때만 어댑터 클로저 생성.
  `this`는 시그니처에서 정해짐(지금은 ref). TS `this: T` 선언과 call/apply는 그 자리 타입만 바꾸면 됨
- 측정(2026-11-06, Ryzen 9 9950X, -O2, ns/호출, 벤치 tmp/object-layout/dispatch.cpp, call-abi.cpp)
  - 클래스 계층 메소드 호출, 4096/100만 객체: 검사 없는 vtable 0.90~1.45, 부모 체인 검사 + vtable 1.26~1.68(깊이 3에서 +0.6),
    display(깊이별 배치 id) + vtable 0.91~1.38(검사 비용 0), 완전 해시 + 종류 분기 무작위에서 +0.5~1, 완전 해시 함수표 무작위에서 +0.3~0.6.
    16종 무작위는 어느 방식이든 7~8(간접 호출 예측 실패가 지배)
  - closure + this 인자 2개 추가: 1클럭 안팎으로 차이 없음(레지스터 mov). 5개 + 2개로 스택에 넘어가도 차이 없음
- 나중에 볼 최적화: `ssc__core__fn__closure`와 `ssc__core__fn__call`이 템플릿이라 시그니처마다 인스턴스가 생김.
  컴파일 시간 측정(2026-11-07, 서로 다른 시그니처 5,000개 × 호출부 20개, 단일 파일 약 47만 줄, -O1 ThinLTO): 지금 23.9초,
  closure 템플릿 제거 21.8초(-9%), 둘 다 제거하고 호출부에서 직접 캐스팅 19.4초(-19%). -O0에서는 직접 캐스팅이 오히려 조금 느림(9.3 → 9.1~9.3초).
  한 단계 중첩 템플릿에서도 폭발적 증가는 없었음. 지금 단계에서는 감수하고 유지. 측정 코드는 tmp/closure-compile/gen.py(시그니처 수, 호출부 수, 방식을 인자로 받아 C++ 파일 생성)

다음 단계
3. 필드 접근 (2026-11-06 방향 결정, 측정 후 확정)
   - 클래스 타입 수신자라도 plain object가 들어올 수 있음(구조적 타입). 필드가 더 많은 plain object는 오프셋이 달라 정적 읽기가 안전하지 않음
   - 클래스 필드를 단계별로 정렬(부모 필드 정렬 → 자기 필드 정렬). 출력 순서는 descriptor keys로 선언 순서 유지.
     상속 없는 클래스는 같은 필드의 plain object와 shape가 같아짐
   - descriptor에 레이아웃 display: 깊이별로 그 단계까지의 shape id. plain object는 [자기 shape id]
   - 클래스 C(깊이 k) 타입 수신자: `display_length > k && display[k] == C의 shape id`면 C의 정적 오프셋, 아니면 key → 값 표(완전 해시).
     자식 클래스와 같은 필드의 plain object는 정적, 나머지는 해시라 최악이 없음. 클래스가 아닌 타입 수신자는 처음부터 해시
   - 지금의 shape id 비교 → strcmp 검색은 제거
   - 측정: display + 정적 / 순수 해시 / 정적 기준선을 tmp/object-layout에 추가해서 비교한 뒤 확정
   - descriptor 필드 순서: 지금은 추가한 순서라 가장 자주 읽는 member_table이 88바이트 중 끝(64~88, 두 번째 캐시 줄)에 있음.
     자주 쓰는 필드(member_table, display, shape_pointer, destroy, super)를 앞 64바이트로, 출력용(to_string, inspect, keys, class_name)을
     뒤로 옮기고 alignas(64)로 정렬하는 것이 유효한지 같은 벤치에서 측정. 바꾸면 descriptor 초기화를 지정 초기화(.member = …)로 전환
4. 접근자, static, `#private`, abstract, 메소드 값
5. Error 클래스와 prelude 에러를 Error 객체로 전환

[제네릭]
방향: shape별 단일 구현(Go 1.18+의 GC shape stenciling + dictionary 방식)
- 참조 타입은 모두 같은 shape(`ref` 8바이트)라 구현 하나를 공유. `Array<User>`, `Array<string>`이 같은 코드
- 기본 타입(i8~u64, f32, f64, boolean, char)은 크기와 연산이 달라 shape별로 따로 생성. 최대 십여 개로 고정
- 타입별 정보(서술자, 비교, 해시 등)는 객체의 서술자나 숨은 사전 인자로 넘김
- 증분 빌드: 제네릭 함수가 정의된 모듈의 `.o`에만 들어가, 본문을 고쳐도 그 모듈만 다시 컴파일함
- 성능이 필요한 곳은 LTO의 인라인·특수화로 보완

비교
- C++ 템플릿, Rust: 타입마다 생성. 실행 비용 0, 대신 인스턴스가 사용 타입 수만큼 늘고 본문 변경 시 쓰는 모듈 전부 재컴파일
- Java(타입 소거), OCaml: 단일 구현 + 박싱. 기본 타입까지 박싱되어 `Array<i32>`가 원소당 16바이트 이상
- Swift: 단일 구현 + witness table, 보이는 곳은 컴파일러가 특수화

채택하지 않음
- 기본 타입까지 하나로 합치기: `Array<i32>` 원소가 union(16바이트)이나 박싱 객체가 되어 메모리 4배, 숫자 연산이 느려짐

[C++ 백엔드]
언어 버전
- `-std=c++26`. clang 23 기준 구현된 기능만 씀. reflection, contracts, `#embed` 등은 clang 미구현
- C++23과의 실제 차이: `_` 변수, pack indexing, `= delete("이유")`, 구조 분해 확장, 더 엄격한 검사.
  무한 루프 UB 제거는 DR이라 C++23에도 적용됨

프렐류드 (`prelude/prelude.cppm`)
- `export module ssc;`. 생성 코드는 `import ssc;`로 가져옴. include는 쓰지 않음
- 숫자 타입과 boolean은 `using` 별칭이라 심볼을 만들지 않음
- char는 `char32_t`. C++ 내장 타입이라 u32와 다른 타입으로 구분됨(오버로드 가능)
- 정적 검사: 64비트 플랫폼, 정수 최댓값, 타입 크기
- undefined, null은 빈 구조체. string과 객체는 RC 참조(`ssc__core__type__ref`), union은 `type_id` + 8바이트 값

이름 규칙
- 프렐류드: `ssc__core__<종류>__<이름>` (예: `ssc__core__type__i32`)
- TS 소스: `ssc__ts__<종류>__<이름>` (예: `ssc__ts__fn__add`). `declare function`은 C 이름 그대로
- 파일: namespace `ssc__ts__namespace__<파일id>`, 최상위 문장 초기화 함수 `ssc__core__fn__<파일id>`(namespace 안)
- 종류: `var`(변수, 매개변수), `fn`, `class`, `type`(인터페이스, 타입 별칭, 제네릭 타입 매개변수),
  `member`(필드, 메서드), `label`
- 이유
  - C++ 키워드는 위치와 상관없이 예약됨. 필드와 메서드 이름도 못 씀(`map.delete`, `promise.catch`).
    C++에는 Rust `r#`, Swift 백틱 같은 탈출 문법이 없음
  - TS는 타입과 값의 이름공간이 분리되어 `type Point`와 `const Point`가 공존함 → 종류로 구분
  - 멤버는 하나로 둠. TS는 구조적 타입이라 메서드 `run()`과 함수 값 필드 `run`이 서로 대입됨
  - 항상 붙이는 고정 접두사라 원래 이름을 바로 되돌림. `obj["key"]`, `Object.keys`, reflection도 같은 규칙
- `__`가 든 이름은 C++ 표준상 구현 예약이지만 clang은 기본으로 경고하지 않음
  (`-Wreserved-identifier`에서만). clang 버전을 고정하므로 씀
- 모듈 사이 격리는 C++ 모듈이 보장(strong ownership, 심볼에 모듈 이름 포함). 이름에 모듈 id를 넣지 않음
- 이름 길이에 따른 컴파일 시간 차이는 1~2%(함수 2만 개 기준)

tsgo 연결
- fork의 `tsc/cmd/sscapi`를 N-API 애드온(`built/local/tsc.node`)으로 빌드해 같은 프로세스에서 호출.
  셀프호스팅 후에는 같은 패키지를 c-archive로 정적 링크
- `ApiClient.request(method, params)`: `typescript7/proto`의 `APIMethodInfo`로 타입이 붙은 JSON 요청.
  소스 파일도 JSON(`{ data: base64 }`)으로 받음
- 동기 호출. 이벤트 루프와 async는 셀프호스팅 뒤에 언어 기능으로 따로 설계
- 지금 컴파일러는 라이브러리(`typescript7/sync`) 수준으로 구현하고, `TsApi`·`ProgramApi`·`CheckerApi`
  메서드만 거침. 라이브러리 객체의 메서드(`type.getTypes()`, `symbol.declarations` 등)는 쓰지 않음
- 원시 요청으로 바꿀 때 남은 일: 바이너리 AST 해석, Type·Symbol을 응답 데이터(`TypeResponse` 등)로 교체

예외
- C++ 예외(표 기반)를 그대로 씀. TS `throw`/`try`/`catch`가 1:1로 내려가고 JS 의미가 보존됨
- 링크: `-fexceptions -nostdlib++ --rtlib=compiler-rt --unwindlib=none` + LLVM 배포판의
  `libc++abi.a`, `libunwind.a` 정적 링크. 동적 의존은 libc, libm만 남음
- 지원 대상: 리눅스, 맥, 윈도우, 안드로이드. 임베디드는 보류(필요하면 `-fno-exceptions` + throw 시 종료 모드)
- 측정(x86-64, -O2, strip)
  - 크기: 예외 없음 5.7KB, 배포판 그대로 + `--gc-sections` 231KB. 프로그램 크기와 무관한 고정 비용.
    대부분 libc++abi의 demangler(약 115KB, 잡히지 않은 예외 메시지용).
    `LIBCXXABI_NON_DEMANGLING_TERMINATE`로 직접 빌드하면 약 56KB
  - 참고: Rust std 바이너리 약 306KB, musl 정적 printf 22KB
  - 오류 없을 때 호출 비용: C++ 예외 +0~3%, 반환값 방식 +12~75%, Swift 오류 레지스터 방식 +1~74%
  - throw 비용: 깊이 10에서 throw 후 catch 1회 약 10μs(반환값 방식 7.8ns). 예외를 흐름 제어로 많이 쓰는 코드는 느림
- 반환값·변수(thread_local) 방식은 호출마다 검사가 필요해 식을 쪼개야 함 → 1:1 대응이 깨지고 숨은 동작이 생김.
  문장 끝에서 한 번 검사하면 throw 뒤의 호출이 실행되어 JS 의미가 달라짐
- 범위 밖 배열 접근은 예외가 아니라 `undefined` 반환(`noUncheckedIndexedAccess` 강제). 정수 0 나누기 등 UB가 되는
  연산은 검사 후 throw. 메모리 부족과 스택 넘침 처리는 미정

평가 순서 (미정, Windows 지원 시작 때 결정)
- JS는 함수 인자와 이항 연산 피연산자를 왼쪽부터 평가. C++은 인자 순서를 정하지 않음(C++17도 indeterminately
  sequenced). 우리 산술도 `ssc__core__fn__add(a, b, "i32")` 호출이라 같은 문제
- 실측 `f(g(), h())`: clang Linux `g → h`, GCC `h → g`, clang MSVC 타깃 `h → g`
- clang 규칙(`clang/lib/CodeGenUtils/CallUtils.cpp` `shouldEvaluateArgsLeftToRight`): MS ABI만 오른쪽부터
  (호출된 쪽이 인자를 소멸시키는 ABI라서), Itanium 계열(Linux, macOS, Android, iOS, WebAssembly, MinGW)은 왼쪽부터.
  지금은 이 동작에 기대고 `test/fixture/order.ts`가 회귀를 잡음
- P0145는 인자를 왼쪽부터로 정하자는 원안이었으나 미지정 대안이 채택됨. clang에 순서를 강제하는 옵션은 찾지 못함
- 후보와 단점
  - 부수 효과를 추측해 필요한 곳만 임시 변수: 추측이 빗나가면 조용히 틀림. 채택 안 함
  - 여러 값을 평가하는 모든 곳을 람다 + 임시 변수로 감쌈: 생성 코드와 컴파일 시간이 부풂
  - 문장 단위 임시 변수(ANF, Zig C 백엔드·Cython·CHICKEN 방식): 확실하지만 lowering 전체와 `&&`·`?:`·루프 조건
    구조를 바꾸는 큰 리팩터링
  - 중괄호 초기화 `{a, b}`: [dcl.init.list]가 왼쪽부터를 보장하고 clang은 MSVC 타깃에서도 지킴(실측).
    대신 연산자 함수는 집합체를 받고, TS 함수는 매개변수 집합체를 받고, C 함수는 래퍼가 필요해 호출 규약이 바뀜
  - Windows를 MinGW ABI(`x86_64-w64-windows-gnu`)로만 지원: 코드 변경 없음, 표준이 아니라 고정한 clang 동작에 의존.
    MSVC로 컴파일된 C++ 라이브러리와 섞을 수 없음

빌드 플래그 (`SscBuildManager.clangCompileFlag`, `clangEmitFlag`, `clangCommonFlag`)
- 공통(컴파일과 링크 모두): `-O{optLevel}`, `-flto=thin`. 링크에 `-flto`가 없으면 `-O`가 lld에 전달되지 않아
  조용히 lld 기본값 -O2로 동작함(측정 확인). ThinLTO는 컴파일(파일 단위 정리)과 링크(합친 뒤 최적화, 기계어) 모두
  최적화 수준을 씀. 사용자에게는 optLevel 하나로 둠(clang, Rust와 같음)
- 컴파일: `-std=c++26`, `-fexceptions`, `-ffp-contract=off`, `-Wno-parentheses-equality`, debug면 `-g`
- 링크: `-fuse-ld=lld`, `-nostdlib++`, `--rtlib=compiler-rt`, `--unwindlib=none`, `libc++abi.a`, `libunwind.a`
  - lld, compiler-rt: 빌드할 때 시스템 binutils, GCC에 의존하지 않고 LLVM 하나로 완결(결과물 의존성은 같음)
  - `--unwindlib=none` 명시: 생략하면 안드로이드, AIX, clang 설정 파일에서 libunwind가 자동으로 붙어 겹침
- clang 실행 파일과 런타임 경로는 `PathResolver`(`clangPath`, `libcxxabiPath`, `libunwindPath`)에서만 정함

모듈 구조 (생성 코드)
- 프렐류드는 모듈 `ssc`. 그 외 모든 코드(사용자 프로젝트 + 라이브러리)는 모듈 `ts` 하나
- `ts.cppm`(기본 인터페이스)은 파일별 초기화 함수 선언만 export. TS 파일 하나 = `.cpp` 구현 단위 하나(`module ts;`)
- namespace: 파일마다 `ssc__ts__namespace__<파일id>` 하나. 파일 실제 경로는 프로그램 안에서 유일해 이것만으로 격리됨
  (같은 라이브러리의 다른 버전은 경로가 달라 공존, pnpm 링크로 공유되는 같은 파일은 실제 경로가 같아 하나).
  패키지 namespace는 두지 않음. unsafe 추적도 모든 파일을 보고 unsafe 코드가 있는지만 판단하면 됨
  id는 `SscIdManager`의 고정 id(반복 빌드에서 같음). 경로 해시 등 결정적 id는 보류
- 다른 파일 참조는 항상 전체 namespace 접두사로 씀(같은 파일도 포함). 접두사 호출은 ADL이 일어나지 않음
- 다른 파일의 것은 import 없이 전방 선언으로 씀: 함수, 변수(`extern`), 클래스 필드는 소유 파일의 접근 함수로.
  같은 모듈 소속이라 전방 선언이 통함. 파일 간·패키지 간 순환도 같은 방식으로 처리됨
  - 확인: 함수 상호 호출, 변수 상호 참조, 접근 함수로 필드 상호 접근, 두 패키지 간 순환(모듈 하나 구조로는 함수만 재확인)
  - 접근 함수는 ThinLTO가 링크 때 인라인해 직접 접근과 같은 기계어가 됨(-O1~-O3 확인). -O0에서는 호출이 남음
- 파일끼리 import가 없어 파일마다 BMI가 필요 없음. 모든 파일이 `ts.pcm`만 보고 바로 `.o`로 컴파일되어 전부 병렬.
  TS 파일 하나를 고치면 그 `.o`만 다시 만듦
- 확인한 사실
  - C++20 모듈은 import 순환을 허용하지 않음(clang 문서도 위상 순서 컴파일 전제)
  - 다른 모듈 소속 함수는 전방 선언할 수 없음(자기 모듈 소속의 다른 함수가 되어 링크 실패)
  - `extern "C++"`는 전역 소속으로 되돌리는 우회라 쓰지 않음
  - partition 인터페이스는 기본 인터페이스가 모두 export해야 해서, 파일마다 `.cppm`이면 한 파일 수정이 연쇄 재컴파일로 번짐
  - 모듈 파일은 함수 본문만 바꿔도 BMI가 바뀜(Reduced BMI 포함, clang 23)
  - 패키지마다 모듈을 나누면 라이브러리 → 사용자 코드 import가 있을 때 순환이 생겨 빌드 불가 → 나누지 않음
- 남은 일
  - 최상위 초기화 순서와 TDZ: C++ 전역 초기화는 파일 간 순서가 없어, C 백엔드처럼 파일별 초기화 함수를 순서대로 호출
  - `import * as ns`를 값으로 쓰는 경우 모듈 namespace 객체, 재내보내기, 필드 쓰기·메서드·상속 확인, 동적 `import()`
  - 증분 빌드: 처음에는 바뀐 파일과 영향받는 파일을 보수적으로 다시 컴파일하고, TS 수준 변경 분석으로 점점 줄임

최상위 변수 (아직 지원 안 함, 변수 선언은 `not implemented`로 멈춤)
- 정의는 값 없이 두고 파일 초기화 함수(`ssc__core__fn__<id>`)에서 대입. C++ 전역 초기값(`T x = f();`)은
  `main` 이전에 파일 간 순서 없이 실행되어 import 순서와 달라지고, 예외·에러 출력 준비 전에 돔
- TDZ 검사는 선언 전에 접근될 수 있는 변수에만 넣음(순환 import, 호이스팅된 함수에서 참조 등). C 백엔드도 같음
- 링키지는 함수와 같음: export면 namespace 안 정의, 아니면 `static`(다른 파일에서 `extern`으로 선언해도 링크 실패 확인).
  다른 파일의 export 변수는 쓰는 파일에 `namespace <소유 파일> { extern T x; }` 전방 선언
- `export declare const`는 `extern "C" T x;`(C 전역 변수, 예: `environ`). 함수와 같은 규칙으로 `export`, `declare` 명시 필요

std 사용
- 편해지는 부분은 적극 활용. 최적화가 필요해지면 그때 의존을 줄임
- `import std;`로 가져옴(배포판에 `std.cppm` 있음). 측정: std.pcm 빌드 약 1초(한 번), import만 하면 컴파일 +0.001s,
  vector 사용 0.038s(`#include <vector>`는 0.137s). 실행 파일은 쓴 것만 들어감(import만 하면 크기 변화 없음)
- vector는 예외 런타임 위에 +2KB. `<charconv>`(숫자 ↔ 문자열, 가장 짧은 표현)는 +142KB
- 피할 것: `<iostream>`, locale, `<format>`(큼), `std::regex`(JS 의미와 다름), `std::unordered_map`(삽입 순서 없음).
  JS `Map`은 엔트리 배열(삽입 순서) + 해시 인덱스로 직접 구현(V8 OrderedHashMap, CPython dict 방식)
- 아직 빌드 경로에 연결하지 않음. 처음 필요한 시점에 std.pcm 빌드와 `libc++.a` 링크를 추가
