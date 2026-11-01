import std;
import ssc;

template <typename Read> static bool throws(Read read, const char* expected) {
  try {
    read();
  } catch (const std::string& message) {
    return message == expected;
  }
  return false;
}

static bool equals(const ssc__core__type__ref& left, const ssc__core__type__ref& right) {
  return ssc__core__fn__strict_equals(left, right);
}

int main() {
  const ssc__core__type__ref text = ssc__core__fn__string_literal<u"\xD55C\xD83D\xDC4D" u"a">();
  const ssc__core__type__ref bytes = ssc__core__fn__bstring_literal<u8"한👍a">();
  const char* utf8_error = "RangeError: The bytes are not valid UTF-8";
  const char* surrogate_error = "RangeError: A lone surrogate can not be encoded as UTF-8";

  if (ssc__core__fn__string_length(text) != ssc__core__type__number(4.0)) {
    return 1;
  }
  if (ssc__core__fn__string_compare(ssc__core__fn__string_literal<u"\xD83D\xDC4D">(), ssc__core__fn__string_literal<u"\xFF61">()) != -1) {
    return 2;
  }
  if (ssc__core__fn__bstring_compare(ssc__core__fn__bstring_literal<u8"👍">(), ssc__core__fn__bstring_literal<u8"｡">()) != 1) {
    return 3;
  }
  if (!equals(ssc__core__fn__string_concat(ssc__core__fn__string_literal<u"a">(), ssc__core__fn__string_literal<u"b">()), ssc__core__fn__string_literal<u"ab">())) {
    return 4;
  }
  if (equals(ssc__core__fn__string_literal<u"a">(), ssc__core__fn__string_literal<u"b">())) {
    return 5;
  }
  if (!equals(ssc__core__fn__string_to_bstring(text), bytes) || !equals(ssc__core__fn__bstring_to_string(bytes), text)) {
    return 6;
  }
  if (!throws([] { ssc__core__fn__string_to_bstring(ssc__core__fn__string_literal<u"\xD800">()); }, surrogate_error)) {
    return 7;
  }
  if (!throws([] { ssc__core__fn__string_to_u8_array(ssc__core__fn__string_literal<u"a\xDC00">()); }, surrogate_error)) {
    return 8;
  }
  if (!equals(ssc__core__fn__u8_array_to_bstring(ssc__core__fn__array_of<ssc__core__type__u8>(ssc__core__type__u8{0xF0}, ssc__core__type__u8{0x9F}, ssc__core__type__u8{0x91}, ssc__core__type__u8{0x8D})), ssc__core__fn__bstring_literal<u8"👍">())) {
    return 9;
  }
  if (!equals(ssc__core__fn__u8_array_to_string(ssc__core__fn__array_of<ssc__core__type__u8>(ssc__core__type__u8{0xF0}, ssc__core__type__u8{0x9F}, ssc__core__type__u8{0x91}, ssc__core__type__u8{0x8D})), ssc__core__fn__string_literal<u"\xD83D\xDC4D">())) {
    return 10;
  }
  if (!throws([] { ssc__core__fn__u8_array_to_bstring(ssc__core__fn__array_of<ssc__core__type__u8>(ssc__core__type__u8{0xC0}, ssc__core__type__u8{0x80})); }, utf8_error)) {
    return 11;
  }
  if (!throws([] { ssc__core__fn__u8_array_to_bstring(ssc__core__fn__array_of<ssc__core__type__u8>(ssc__core__type__u8{0xED}, ssc__core__type__u8{0xA0}, ssc__core__type__u8{0x80})); }, utf8_error)) {
    return 12;
  }
  if (!throws([] { ssc__core__fn__u8_array_to_bstring(ssc__core__fn__array_of<ssc__core__type__u8>(ssc__core__type__u8{0xF5}, ssc__core__type__u8{0x80}, ssc__core__type__u8{0x80}, ssc__core__type__u8{0x80})); }, utf8_error)) {
    return 13;
  }
  if (!throws([] { ssc__core__fn__u8_array_to_string(ssc__core__fn__array_of<ssc__core__type__u8>(ssc__core__type__u8{0xE2}, ssc__core__type__u8{0x82})); }, utf8_error)) {
    return 14;
  }
  if (!throws([] { ssc__core__fn__u8_array_to_string(ssc__core__fn__array_of<ssc__core__type__u8>(ssc__core__type__u8{0x80})); }, utf8_error)) {
    return 15;
  }
  if (ssc__core__fn__string_length(ssc__core__fn__u16_array_to_string(ssc__core__fn__array_of<ssc__core__type__u16>(ssc__core__type__u16{0xD800}))) != ssc__core__type__number(1.0)) {
    return 16;
  }
  if (!equals(ssc__core__fn__u8_array_to_bstring(ssc__core__fn__bstring_to_u8_array(bytes)), bytes)) {
    return 17;
  }
  if (ssc__core__fn__array_length(ssc__core__fn__string_to_u8_array(ssc__core__fn__string_literal<u"\xD55C">())) != 3) {
    return 18;
  }
  if (!equals(ssc__core__fn__to_string(ssc__core__type__number(9223372036854775808.0)), ssc__core__fn__string_literal<u"9223372036854776000">())) {
    return 19;
  }
  if (!equals(ssc__core__fn__to_string(ssc__core__type__i32{-5}), ssc__core__fn__string_literal<u"-5">()) || !equals(ssc__core__fn__to_string(true), ssc__core__fn__string_literal<u"true">())) {
    return 20;
  }
  if (!equals(ssc__core__fn__to_string(bytes), text)) {
    return 21;
  }
  if (!equals(ssc__core__fn__typeof(ssc__core__type__union(text)), ssc__core__fn__string_literal<u"string">())) {
    return 22;
  }
  if (!ssc__core__fn__union_is_string(ssc__core__type__union(text)) || ssc__core__fn__union_is_bstring(ssc__core__type__union(text))) {
    return 23;
  }
  if (ssc__core__fn__truthy_ref(ssc__core__fn__string_literal<u"">()) || !ssc__core__fn__truthy_ref(text)) {
    return 24;
  }
  if (!equals(ssc__core__fn__to_string(ssc__core__fn__array_of<ssc__core__type__ref>(text, bytes)), ssc__core__fn__string_literal<u"\xD55C\xD83D\xDC4D" u"a,\xD55C\xD83D\xDC4D" u"a">())) {
    return 25;
  }
  if (ssc__core__fn__char(ssc__core__fn__string_literal<u"\xD83D\xDC4D">()) != 0x1F44D || !throws([] { ssc__core__fn__char(ssc__core__fn__string_literal<u"ab">()); }, "RangeError: Invalid code point 'ab'")) {
    return 26;
  }
  return 0;
}
