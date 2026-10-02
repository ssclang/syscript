// /*
//  * 헤더를 libclang으로 파싱해 bindgen이 읽을 JSON을 표준 출력에 쓴다.
//  *
//  * `-ast-dump=json`은 clang 내부 형식이라 버전마다 바뀔 수 있다. 여기서는 libclang의 공개
//  * API만 쓰고 출력 형식은 우리가 정해, clang이 바뀌어도 이 파일 밖은 영향을 받지 않는다.
//  *
//  * 사용법: dump <header> <resource-dir> [clang 인자...]
//  */
// #include <clang-c/Index.h>
// #include <stdio.h>

// typedef struct {
//   int first;
// } State;

// static void json_string(const char *s) {
//   putchar('"');

//   for (; *s; s++) {
//     if (*s == '"' || *s == '\\') {
//       putchar('\\');
//       putchar(*s);
//     } else if ((unsigned char)*s < 0x20) {
//       printf("\\u%04x", *s);
//     } else {
//       putchar(*s);
//     }
//   }

//   putchar('"');
// }

// static void cx_string(CXString s) {
//   json_string(clang_getCString(s));
//   clang_disposeString(s);
// }

// static void json_bool(const char *key, int value) {
//   printf(",\"%s\":%s", key, value ? "true" : "false");
// }

// /*
//  * `kind`는 typedef를 모두 벗긴 정규 타입 기준이고, `spelling`은 적힌 그대로다.
//  * 매핑은 `kind`로 판단하고, C 이름을 보존할 때는 `spelling`을 쓴다.
//  */
// static void json_type(CXType type) {
//   CXType canonical = clang_getCanonicalType(type);

//   printf("{\"kind\":");
//   cx_string(clang_getTypeKindSpelling(canonical.kind));
//   printf(",\"spelling\":");
//   cx_string(clang_getTypeSpelling(type));
//   json_bool("const", clang_isConstQualifiedType(type));

//   if (canonical.kind == CXType_Pointer) {
//     /* typedef로 감싼 포인터는 원래 타입에서 가리키는 대상을 못 꺼내므로 정규 타입에서 꺼낸다 */
//     CXType pointee = clang_getPointeeType(type);

//     if (pointee.kind == CXType_Invalid) {
//       pointee = clang_getPointeeType(canonical);
//     }

//     printf(",\"pointee\":");
//     json_type(pointee);
//   }

//   putchar('}');
// }

// static void json_function(CXCursor cursor, State *state) {
//   CXType type = clang_getCursorType(cursor);
//   unsigned line;

//   clang_getSpellingLocation(clang_getCursorLocation(cursor), NULL, &line, NULL, NULL);

//   printf("%s{\"name\":", state->first ? "" : ",");
//   state->first = 0;
//   cx_string(clang_getCursorSpelling(cursor));
//   printf(",\"line\":%u", line);
//   json_bool("invalid", clang_isInvalidDeclaration(cursor));
//   json_bool("variadic", clang_isFunctionTypeVariadic(type));
//   printf(",\"returns\":");
//   json_type(clang_getResultType(type));
//   printf(",\"params\":[");

//   for (int i = 0, count = clang_Cursor_getNumArguments(cursor); i < count; i++) {
//     CXCursor argument = clang_Cursor_getArgument(cursor, i);

//     printf("%s{\"name\":", i ? "," : "");
//     cx_string(clang_getCursorSpelling(argument));
//     printf(",\"type\":");
//     json_type(clang_getCursorType(argument));
//     putchar('}');
//   }

//   printf("]}");
// }

// static enum CXChildVisitResult visit(CXCursor cursor, CXCursor parent, CXClientData data) {
//   (void)parent;

//   /* include로 딸려온 선언은 대상이 아니다 */
//   if (!clang_Location_isFromMainFile(clang_getCursorLocation(cursor))) {
//     return CXChildVisit_Continue;
//   }

//   /* 같은 함수를 여러 번 선언하면 정규 커서가 첫 선언을 가리킨다. 첫 선언일 때만 낸다 */
//   if (!clang_equalCursors(cursor, clang_getCanonicalCursor(cursor))) {
//     return CXChildVisit_Continue;
//   }

//   if (clang_getCursorKind(cursor) == CXCursor_FunctionDecl) {
//     json_function(cursor, data);
//   }

//   return CXChildVisit_Continue;
// }

// /*
//  * 파싱이 성공해도 libclang은 오류를 복구하며 틀린 타입을 낸다. 내장 헤더를 못 찾으면
//  * `size_t`가 `int`가 되는 식이다. 에러 진단이 하나라도 있으면 결과를 버린다.
//  */
// static unsigned report_errors(CXTranslationUnit unit) {
//   unsigned errors = 0;

//   for (unsigned i = 0, count = clang_getNumDiagnostics(unit); i < count; i++) {
//     CXDiagnostic diagnostic = clang_getDiagnostic(unit, i);

//     if (clang_getDiagnosticSeverity(diagnostic) >= CXDiagnostic_Error) {
//       CXString text = clang_formatDiagnostic(diagnostic, clang_defaultDiagnosticDisplayOptions());

//       fprintf(stderr, "%s\n", clang_getCString(text));
//       clang_disposeString(text);
//       errors++;
//     }

//     clang_disposeDiagnostic(diagnostic);
//   }

//   return errors;
// }

// int main(int argc, char **argv) {
//   enum { max_args = 64 };
//   const char *args[max_args];
//   int count = 0;

//   if (argc < 3) {
//     fprintf(stderr, "usage: dump <header> <resource-dir> [clang args...]\n");
//     return 2;
//   }

//   args[count++] = "-x";
//   args[count++] = "c";
//   args[count++] = "-std=gnu23";
//   args[count++] = "-resource-dir";
//   args[count++] = argv[2];

//   for (int i = 3; i < argc && count < max_args; i++) {
//     args[count++] = argv[i];
//   }

//   CXIndex index = clang_createIndex(0, 0);
//   CXTranslationUnit unit;
//   enum CXErrorCode code = clang_parseTranslationUnit2(
//     index, argv[1], args, count, NULL, 0, CXTranslationUnit_SkipFunctionBodies, &unit);

//   if (code != CXError_Success) {
//     fprintf(stderr, "parse failed (%d): %s\n", code, argv[1]);
//     clang_disposeIndex(index);
//     return 1;
//   }

//   if (report_errors(unit)) {
//     clang_disposeTranslationUnit(unit);
//     clang_disposeIndex(index);
//     return 1;
//   }

//   State state = { 1 };

//   printf("{\"functions\":[");
//   clang_visitChildren(clang_getTranslationUnitCursor(unit), visit, &state);
//   printf("]}\n");

//   clang_disposeTranslationUnit(unit);
//   clang_disposeIndex(index);

//   return 0;
// }
