// 불변은 val, 가변은 var
// 함수는 값: val 이름 = fn (파라미터) 식
// 블록도 식이고, 블록의 값은 마지막 식
val one = fn () {
    1
}

// 값을 반환하지 않으려면 마지막 줄에 값 없는 return
val noValue = fn () {
    one()
    return
}

// 본문이 식 하나면 중괄호 없이
val addOne = fn (x) x + 1

// 타입은 전부 추론 (파라미터, 반환, export 포함)
val add = fn (a, b) {
    a + b
}

// 콜백은 값으로 전달 (후행 람다 없음)
val twice = fn (f, x) f(f(x))
val four = twice(addOne, 2)

// 세미콜론 없음: 줄바꿈은 식의 끝 (줄 끝 토큰과 상관없이 엄격하게)
// ( [ 안과 object 리터럴 { } 안에서는 닫힐 때까지 줄바꿈을 무시, 블록 { } 안에서는 줄바꿈이 다시 식의 끝
val total = add(
    1,
    2
)

// 가변 값은 var
val counter = fn () {
    var count = 0
    count = count + 1
    count
}

// 상수 키워드 없음: 컴파일 시점에 결정 가능한 값은 자동으로 상수
// 상수 표현식은 리터럴, 연산자, 다른 상수의 조합
val size = 4
val area = size * size

// 상수 함수 여부도 추론, 인자와 내부 함수 호출이 전부 상수인 상수 함수 호출은 상수 표현식 (나중에 구현)
val sizePlusOne = addOne(size)

// 타입도 값이라 같은 형태: val 이름 = type { ... } (내부 멤버 문법은 미정)

// 빈 값은 none 하나뿐 (undefined, null 없음)
// 값 없는 return으로 끝나는 함수의 결과도 none
val nothing = noValue()

// union이 타입 시스템의 핵심, 타입 표기는 타입스크립트와 비슷하게
// 타입은 보통 추론하고, 필요할 때만 표기
var found: i64 | none = none
val assignFound = fn () {
    found = 3
}

// plain object: 이름 없는 객체 값, 모양(필드 이름과 타입)이 정확히 같아야 같은 타입
// 필드가 더 많거나 적으면 다른 타입 (구조적 서브타이핑 없음)
// 메모리 배치는 필드 이름순 정렬이라 적는 순서와 상관없이 같은 타입
val origin = { x: 0, y: 0 }
val moved = { y: 3, x: 4 }

// { 해석 규칙: 위치와 상관없이 기본은 블록
// 안에 이름: 또는 이름, 이 있으면 plain object ({ x }, {}도 블록)
// 블록에서 줄을 지워도 : 나 , 가 생기지 않으니 블록이 plain object로 바뀌지 않음
// 축약 필드도 쉼표를 남기는 게 정상 사용법, 포매터는 마지막 필드 뒤에 항상 쉼표를 붙임
val wrapped = { origin, }
val sameAsOrigin = { origin }
val computed = {
    val doubled = size * 2
    doubled + 1
}

// 값이나 변수 하나만 있는 본문은 중괄호 없이 인라인으로
val getOrigin = fn () origin
val wrapOrigin = fn () { origin, }

// {}는 빈 블록이라 값은 none, 빈 값은 none으로 바로 써도 됨
val doNothing = fn () none
val alsoNothing = fn () {}

// 반복문은 loop 하나 (while, for 없음), loop도 식
// 조건 없는 loop는 break가 없으면 never, break가 있으면 none
// 조건이 있는 loop(조건 반복, C식, 순회)는 항상 none
// 조건은 항상 괄호로 감쌈
// 본문도 같은 { 해석 규칙과 중괄호 생략 규칙을 따르고, 본문의 값은 매번 버려짐
var remaining = 3

// 무한 반복 (= while (true))
val infiniteLoop = fn () {
    loop {
        remaining = remaining - 1
    }
}

// 조건 반복 (= while (조건))
val whileLoop = fn () {
    loop (remaining > 0) {
        remaining = remaining - 1
    }
    loop (remaining > 0) doNothing()
    loop (remaining > 0) none
    loop (remaining > 0) { x: 1 }
}

// C식 반복 (= for (초기; 조건; 증가)), 괄호 안의 ;는 구분자
val forLoop = fn () {
    loop (var i = 0; i < size; i += 1) {
        std.out(i)
    }
}

// 순회 (= for (val 원소 of 대상)), 반복 변수는 매번 새로 생기는 val
// 배열 리터럴은 []
val numbers = [1, 2, 3]
val forOfLoop = fn () {
    loop (val number of numbers) {
        std.out(number)
    }
}

// 할당은 식, 값은 할당된 값, 오른쪽부터 묶임 (a = b = c는 a = (b = c))
// 복합 할당(+=, -=, *=, /=)도 식, ++와 --는 없음
// 계산 순서는 항상 왼쪽에서 오른쪽
val chainAssign = fn () {
    var first = 0
    var second = 0
    var third = first = second = 7
    var fourth = second += 5
}

// truthy 판정: false와 none만 falsy, 그 외는 전부 truthy (0, '', [], 빈 plain object 포함)
val printLatest = fn () {
    var latest: i64 | none = none
    if (latest = found) {
        std.out(latest)
    }
}

// 숫자로 셀 때는 비교를 명시
var countdown = 3
val countDown = fn () {
    loop ((countdown -= 1) > 0) doNothing()
}

// 타입 이름이 곧 변환 함수, 암묵적 변환 없음
val wide = i64(size)
val convertFound = fn () {
    val flag = bool(found)
}

// present: 0, 0.0, -0.0, NaN, '', [], 빈 plain object까지 비어 있는 것으로 보고 false (Infinity는 true)
// blank는 그 반대
val countDownWhilePresent = fn () {
    loop (present(countdown -= 1)) doNothing()
}
val nameMissing = blank('')

// if는 식, 조건은 항상 괄호로 감싸고 본문은 인라인 또는 블록
// else와 else if (else 뒤에 if 식이 하나 더 오는 것), } else는 같은 줄에
// 삼항 연산자는 없음 (나중에 필요하면 추가, 그때를 위해 ? 한 글자는 다른 용도로 쓰지 않음)
val printSize = fn () {
    if (found) std.out(found)

    if (size > 3) {
        std.out(size)
    } else if (size > 1) {
        std.out(1)
    } else {
        std.out(0)
    }
}

val sign = if (size > 0) 1 else if (size < 0) -1 else 0

// if 식의 타입: 모든 갈래의 타입을 union으로 합침
// else가 없으면 조건이 거짓일 때 none이라 none도 합쳐짐
val ifTypes = fn () {
    val maybe = if (found) 1
    val value = if (found) 1 else 'none yet'
}
val bounded = if (size > 10) 10 else if (size > 0) size

// 문장은 선언(val, var, import, export)뿐이고 나머지는 전부 식
// return, break, continue도 식이라 인라인으로 쓸 수 있음 (타입은 never)
val pick = fn (x) {
    if (x > 10) return 'big'
    x
}

// never: 값이 아예 나오지 않는 타입 (none과 다름)
// return, break, continue, break 없는 loop, 항상 프로세스를 끝내는 함수 등
// union에 합치면 사라짐 (i64 | never = i64)
val checked = fn (ready) {
    val value = if (ready) 1 else return none
    value + 1
}

// 선언은 문장이지만, 조건 자리(if, match, loop의 괄호 안)에서만 예외로 허용
// 그 변수는 해당 갈래 안에서만 보임
val printUser = fn () {
    if (val user = found) std.out(user)
}

// 재할당과 필드 수정은 별개
// val 변수: 재할당 불가, 필드 직접 수정 불가
// var 변수: 재할당 가능, 필드 직접 수정은 그 필드가 var로 선언된 경우만
// 메서드 호출은 변수가 val이든 var든 상관없음 (메서드 안에서도 var 필드만 수정 가능)
// 불변을 확실히 보장해야 하면 메서드 없는 데이터 타입을 넘김

// 멤버는 기본 불변 + private, public으로 읽기 공개, public var로 밖에서의 수정까지 공개
// 공개 범위는 두 겹: 모듈(파일)은 export, 타입은 public / 기본 private
// 기본이 private이라 private 키워드는 없음 (Rust와 같음)
// static 멤버(데이터, 함수)는 타입에 하나만 두고 모든 인스턴스가 공유
// static이 아닌 데이터 필드는 val이든 var든 전부 객체에 저장 (함수 필드 포함)
// static이 아닌 val 함수 리터럴(메서드)은 컴파일러가 타입 쪽 함수로 최적화 (객체에 저장 안 함, 직접 호출)
// var 함수와 생성할 때 넣는 val 함수는 객체에 저장되는 함수 필드 (간접 호출)
// 파일 안에서 공유할 상태는 모듈 수준 변수, 한 타입만 쓸 상태는 (public 없는) static
// (구조체 문법은 미정, 아래는 예시 표기)
// val Widget = type {
//     static var created = 0
//     public static val create = fn () {
//         self.created += 1
//         Widget()
//     }
//     public val label = 'ok'
//     public val describe = fn () self.label
//     public var onClick = fn (self: Widget) std.out(self.label)
// }

// 직렬화: 어떤 값이든 가능, 함수 필드는 빼고 데이터만 저장
// 역직렬화: 함수 필드가 없는 데이터 타입으로만 가능 (함수 필드가 있는 타입이면 컴파일 에러)
// 함수 필드가 있는 객체가 필요하면 역직렬화한 데이터로 직접 생성

// self (this): 타입 안의 함수는 선언 없이 바로 씀
// static 함수에서는 현재 타입, static이 아닌 함수(메서드)에서는 호출한 인스턴스
// 타입 밖에서 선언한 함수가 self를 쓰려면 첫 파라미터에 self: 타입을 명시
// 함수 필드에 담긴 함수의 첫 파라미터가 self면, 인스턴스에서 바로 호출할 때만 자동으로 넣음 (이름 기준)
// 그 외에는 self를 직접 넣어서 호출하는 것도 허용
// self 없는 함수(static)는 타입 이름으로만 호출, 인스턴스로 호출하면 에러 (인스턴스와 관계있어 보이는 착시 방지)
// self는 캡처하지 않고 호출할 때 인자로 넘김 (순환 참조 없음)
// 메서드를 떼어 내면 첫 인자가 self인 독립 함수
// self, this, static은 예약어 (self와 this 중 어느 쪽을 쓸지는 미정)
// (구조체 문법은 미정, 아래는 예시 표기)
// val showLabel = fn (self: Widget) std.out(self.label)
// widget.onClick = showLabel
// widget.onClick()                  // widget이 self로 자동으로 들어감
// val describe = widget.describe    // 떼어 낸 메서드: 첫 인자가 self인 함수
// describe(widget)
// Widget.describe(widget)           // 타입 이름으로 불러도 self를 직접 넘김
// Widget.create()
// widget.create()                   // 에러: self 없는 함수는 인스턴스로 호출할 수 없음

// 타입도 값: type 리터럴은 항상 새 타입 값을 만듦, 타입 값은 컴파일 시점 값이어야 함
// 기존 타입 값을 대입하면 같은 값이라 같은 타입 (별명)
// type 기존타입: 표현은 같고 타입은 다른 새 타입 (예: val UserId = type i64)
// type으로 만든 타입은 명목적, 필드는 선언 순서 (C 구조체와 배치가 같음)
val Point = type { x: i64, y: i64 }
val Size = type { x: i64, y: i64 }
val UserId = type i64
val Id = i64

// as: 실행 중 실패할 수 없다는 게 컴파일 타임에 보장되는 변환만 허용
// 1. 타입만 봐도 항상 성공 (정수 넓히기, 필드 구성이 같은 객체, union 넓히기)
// 2. 컴파일 시점에 계산되는 값(리터럴, 상수 연산, const fn 결과 등)이면 그 값으로 성공하는지 검사
// 3. 타입이 직접 정의한 as 변환 (나중에 확장, 동기 함수만, 실패를 반환할 수 없음, 안에서 터지지 않게 하는 건 사용자 책임)
// 객체 변환은 public 필드를 옮겨 새 값을 만듦 (배치가 같으면 컴파일러가 복사를 생략)
// plain에서 이름 있는 타입으로 바꿀 때 대상의 private 필드는 기본값이 있어야 함
val movedPoint = moved as Point
val movedSize = movedPoint as Size
val manhattan = fn (point: Point) point.x + point.y
val movedDistance = manhattan(movedPoint)

// 생성자: 실패할 수 있는 변환 (정수 좁히기, 정수와 실수 사이, 검증이 필요한 생성)
// 실패하면 Err를 반환
val small = i32(size)

// interface 파라미터: 타입의 public 필드와 메서드(시그니처)를 가진 값이면 무엇이든 받음
// 메서드는 넘어온 객체 자신의 것을 호출 (interface 타입 쪽 본문은 쓰지 않음)
// 원본을 변환하거나 복사하지 않고 [데이터 포인터 | (타입, interface)별 테이블]로 넘김
// 테이블에는 필드 오프셋과 메서드 함수 포인터, 기본은 불변
val sumOf = fn (point: interface Point) point.x + point.y
val sizeSum = sumOf(movedSize)

// 에러도 값: Err(value)로 만들어 반환, 반환 타입은 T | Err<E>로 추론
// throw, try, catch는 없음
// !: none과 Err 멤버를 위로 반환하고 나머지를 남김 (위로 간 타입은 그 함수의 반환 타입에 합쳐짐)
// 그냥 받으면 union 값이라 if, match로 직접 처리
// Option<T>, Result<T, E>는 중첩이나 구조가 필요할 때만 쓰는 명시적 ADT (표준 라이브러리 제네릭 API는 처음부터 이걸로)
// ?.와 ??는 JS처럼 none 처리용
val parse = fn (text) {
    if (text == '') return Err('empty')
    42
}
val parsedPlusOne = fn (text) parse(text)! + 1
val maybePoint: Point | none = none
val maybeX = maybePoint?.x ?? 0

// 이름 없는 타입도 파라미터 타입으로 쓸 수 있음, plain object는 모양이 정확히 같으면 그대로 들어감
// as 다음에 타입이 오면 그 타입으로, 타입 없이 끝나면 대입되는 곳의 타입으로 변환
// 대입되는 곳: 함수 호출 인자, 기존 변수에 대입 (타입을 알 수 없는 곳이면 에러)
val distance = fn (point: { x: i64, y: i64 }) point.x + point.y
val literalDistance = distance({ x: 1, y: 2 })
val pointDistance = distance(movedPoint as)
var lastPoint = movedPoint
val resetLastPoint = fn () {
    lastPoint = moved as
}

// 최상위(파일 수준)에는 선언만, 실행 문장(호출, 대입, loop, if 등)은 함수 안에서만
// import만 해서는 아무것도 실행되지 않음
// 최상위 val, var의 초기값은 컴파일 시점에 계산이 끝나는 값만 (실행 시점 값은 나중에 추가)
// var를 읽는 값은 실행 시점 값
// 최상위 var는 허용, 동기화는 사용자가 atomic 등으로 직접 (여러 스레드에서 쓰이면 경고)
// 모듈 순환 import는 초기 버전에서 금지 (나중에 허용)
// 초기화 순환(전역 값을 지나는 참조 순환)은 컴파일 에러
// 참조만 있어도 의존으로 보고, 어떤 타입을 참조하면 그 타입의 메서드 전체를 참조한 것으로 봄
// 함수끼리만 도는 순환은 재귀라서 허용

// inline: 강제 인라인 (문법 미정)
// inline 함수 본문을 고치면 그 함수를 호출하는 파일만 다시 빌드

// 엔트리 파일에는 val main = fn () { ... }가 있어야 함 (export는 자유)
// main은 파라미터가 없음, 실행 인자는 std.env.arg() 같은 식으로 꺼냄
// 종료 코드: 반환값이 없으면 0, 에러가 main 밖으로 나가면 (! 등) 1, 1바이트 정수 타입을 반환하면 그 값
// 엔트리가 아닌 파일의 main은 일반 함수
val main = fn () {
    printSize()
}

// 문자열 리터럴은 ' 하나만 사용 (" 없음), 타입은 항상 str
// 문자 하나짜리 타입(char)은 없음
// 'x' as 정수타입: 코드 포인트가 정확히 하나인 컴파일 시점 문자열만 가능, 결과는 그 코드 포인트 값
// 값이 대상 타입에 들어가는지도 컴파일 시점에 검사 (안 들어가면 에러)
// 실행 시점 문자열에서 코드 포인트나 바이트를 꺼내는 건 표준 라이브러리 함수로
val letter = 'a'
val word = 'ab'
val letterCode = 'a' as u8
val hangulCode = '한' as u32
// '한' as u8          // 에러: 0xD55C는 u8에 안 들어감
// 'ab' as u8          // 에러: 코드 포인트가 둘
// '' as u8            // 에러: 코드 포인트가 없음

// 문자열 안의 ${식}은 보간 (JS 백틱 리터럴과 같음), $ 혼자는 그냥 글자
// 여러 줄 문자열도 그대로 허용, 줄바꿈이 문자열 안에 그대로 들어감
// 이스케이프: \\, \', \$ (문법과 겹치는 글자), \n, \t, \r, \0, \u{코드 포인트}
// \0은 NUL 하나만 뜻함 (C처럼 8진수 이스케이프로 이어지지 않음, \01은 NUL 다음 1)
// 목록에 없는 이스케이프는 컴파일 에러 (나중에 이스케이프를 추가해도 기존 코드의 의미가 바뀌지 않게)
val name = 'world'
val greeting = 'hello ${name}'
val price = '$5'
val lines = 'first line
second line'
val escaped = 'it\'s \${name} C:\\path'
val tabbed = 'a\tb\nc'
val hangul = '\u{AC00}'
// '\a'                // 에러: 목록에 없는 이스케이프

// 리터럴은 항상 가장 좁은 타입으로 추론 (TS의 as const와 같음, as const 문법은 없음)
// var만 넓힌 타입으로 추론 (바뀔 수 있는 값이라서)
// 좁은 타입은 넓은 타입 자리에 그대로 들어감 ('a'는 str 자리에, [1, 2]는 i64 배열 자리에)
val keywords = ['val', 'var']   // ['val', 'var']
val fixedName = 'a'             // 'a'
var changingName = 'a'          // str

// 리터럴: [ ] 배열, ( ) 튜플, { } object
// 튜플은 쉼표로 구분 (원소 하나면 (a,), (a)는 그냥 묶기), 위치마다 타입이 다른 구조체
// 배열 리터럴은 원소 값까지 타입에 남김 (가장 정확하게 좁힘), 저장은 원소 타입들의 union 배열
// 상수 인덱스면 그 위치의 타입, 실행 시점 인덱스면 원소 타입들의 union | none, 상수 인덱스가 범위 밖이면 에러
val names = ['kim', 'lee']      // ['kim', 'lee']
val mixed = ['kim', 30]         // ['kim', 30], 저장은 (str | i64) 배열
val pair = ('kim', 30)          // ('kim', 30) 튜플

// plain object의 키는 식별자 이름만 (숫자, boolean, 계산된 키는 없음)
// 실행 중에 키를 정해야 하면 Map을 씀, 문자열 키가 필요하면 사용자가 직접 변환해서 넣음

// 자료구조 생성자 (가변인자)
// Array(...items), Set(...items)
// Map(object), Map(튜플 배열), Map(...튜플), object로 만들면 키는 str
// Object(이름: 값, ...): 이름 인자가 그대로 필드가 됨
val nameArray = Array('kim', 'lee')
val ids = Set(1, 2, 3)
val agesFromObject = Map({ kim: 30, lee: 25 })
val agesFromPairs = Map(('kim', 30), ('lee', 25))
val point = Object(x: 1, y: 2)

// type { } 이 구조체 정의 (struct 키워드 없음), 필드에 기본값을 줄 수 있음
// 기본값은 인스턴스를 만들 때마다 계산 (가변 기본값을 인스턴스끼리 공유하지 않음)

// 생성자: 타입 안에 new로 정의 (인스턴스 메서드처럼 생겼지만 static도 인스턴스 메서드도 아닌 별도의 종류)
// Point.new(...)와 Point(...) 둘 다 생성자 호출 (정적으로 결정)
// 인스턴스로 부르는 것(point.new(...))도 허용 (생성자는 static이 아닌 별도의 종류라 static 호출 규칙과 상관없음)
// static new는 에러, new는 예약어가 아님
// 생성자 안의 self는 지금 만들고 있는 인스턴스
// 생성자는 self와 Err만 반환: 끝까지 실행되거나 값 없는 return이면 self, 실패하면 return Err(...)
// 반환 타입은 추론 (실패가 없으면 Point, 있으면 Point | Err)
// self가 반환되는 지점마다 필드가 다 채워졌는지 검사 (덜 채워졌으면 에러)

// 생성자를 하나도 정의하지 않으면 자동 생성자를 만듦 (public)
// 자동 생성자는 함수 타입이 아니고, static도 private도 아닌 필드를 선언 순서대로 받음
// 기본값이 있는 필드는 생략 가능한 매개변수
// 자동 생성자가 받지 않는 필드(함수 타입, private)에 기본값이 없으면 생성자를 직접 정의해야 함
// 생성자를 직접 정의하면 자동 생성자는 밖에서 안 보이고, 생성자 안에서만 self.baseNew(...)로 지금 인스턴스의 필드를 채우는 데 씀 (이름은 baseNew로 가정, 미정)
// 위치 인자로 부를 때는 선언 순서대로 들어가고, 뒤쪽의 기본값 있는 매개변수만 생략 가능
val origin2d = Point(x: 0, y: 0)

// 오버로딩은 생성자에만 허용, 시그니처마다 구현이 따로
// 매개변수 타입과 개수로 구분, 정의할 때 겹치는 생성자가 있으면 에러 (모든 위치에서 타입이 겹치는 값이 있으면 겹침)
// 호출할 때 리터럴 때문에 어느 생성자인지 모호하면 에러, as로 명시
// Point.new를 값으로 꺼내면 OverloadMethod<Point.new> 타입 (어느 묶음인지 타입이 알고 있어서 값은 정보를 들고 있지 않음)
// 이 값을 부르는 곳에서 인자 타입으로 시그니처를 골라 정적으로 연결
// 항상 명확한 타입으로 불러야 함 (제네릭 매개변수 자리에는 넘길 수 없음, 함수 타입 자리에 넘기면 그 타입으로 하나를 고름)

// 모든 함수는 위치 인자와 이름 인자 둘 다로 부를 수 있음 (선언할 때 따로 구분하지 않음)
// 이름 인자를 하나라도 쓰면 나머지도 전부 이름 인자 (섞어 쓸 수 없음), 이름 인자는 순서 상관없음
// 이름을 강제하는 기능은 없음, 엄격하게 쓰고 싶으면 항상 이름 인자로 부르면 됨
// 생성자도 함수라서 같은 규칙 (별도의 객체 생성 리터럴 문법은 없음)
// ...obj: 객체의 필드를 하나씩 꺼내 이름 인자로 넘김 (얕은 복사, 원본 객체가 넘어가지 않음)
// 펼친 필드와 직접 쓴 이름을 합친 결과가 매개변수와 정확히 일치해야 함 (기본값이 있는 매개변수는 빠져도 됨)
// 같은 이름이 여러 번 나오면 뒤에 쓴 게 이김 (JS 객체 펼침과 같음)
// 이름 인자는 호출하는 곳에서 보이는 타입 기준으로 컴파일 타임에 위치 인자로 바뀜
// 그래서 실제 함수의 매개변수 이름은 상관없음, 함수 타입끼리 비교할 때도 매개변수 이름은 무시
val connect = fn (host: str, port: i64) none
val options = { host: 'localhost', port: 80 }
val callConnect = fn () {
    connect('localhost', 80)
    connect(port: 80, host: 'localhost')
    connect(...options)
    connect(...options, port: 81)     // port는 81
    connect(port: 81, ...options)     // port는 80
    // connect('localhost', port: 80) // 에러: 위치 인자와 이름 인자를 섞음
}
val run = fn (callback: (a: i64) => i64) callback(a: 1)
val runResult = fn () run(fn (x) x + 1)
