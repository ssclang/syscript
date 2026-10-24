import std;
import ssc;

template <typename Read> static int check(Read read, const char* expected) {
  try {
    read();
  } catch (const std::string& message) {
    return message == expected ? 0 : 1;
  }
  return 1;
}

int main() {
  if (check([] { ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__type__union(ssc__core__var__undefined)); }, "TypeError: Type 'undefined' is not assignable to type 'number'")) {
    return 1;
  }
  if (check([] { ssc__core__fn__union_to_number<ssc__core__type__i64>(ssc__core__type__union(true)); }, "TypeError: Type 'boolean' is not assignable to type 'number'")) {
    return 2;
  }
  if (check([] { ssc__core__fn__union_to_number<ssc__core__type__i32>(ssc__core__type__union()); }, "TypeError: Type '#0' is not assignable to type 'number'")) {
    return 3;
  }
  if (check([] { ssc__core__fn__union_to_boolean(ssc__core__type__union(ssc__core__type__i32{1})); }, "TypeError: Type 'i32' is not assignable to type 'boolean'")) {
    return 4;
  }
  if (check([] { ssc__core__fn__union_to_undefined(ssc__core__type__union(ssc__core__var__null)); }, "TypeError: Type 'null' is not assignable to type 'undefined'")) {
    return 5;
  }
  return 0;
}
