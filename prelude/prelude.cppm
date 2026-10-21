export module ssc;

import std;

extern "C" void* malloc(__SIZE_TYPE__ size) noexcept;
extern "C" void free(void* pointer) noexcept;

export struct ssc__core__struct__object_header;
export struct ssc__core__struct__descriptor;
export inline void ssc__core__fn__clone_rc(ssc__core__struct__object_header* object_header_pointer) noexcept;
export inline void ssc__core__fn__drop_rc(ssc__core__struct__object_header* object_header_pointer) noexcept;

static_assert(sizeof(__SIZE_TYPE__) == 8);
static_assert(sizeof(void*) == 8);
static_assert(__INT8_MAX__ == 127);
static_assert(__INT16_MAX__ == 32767);
static_assert(__INT32_MAX__ == 2147483647);
static_assert(__INT64_MAX__ == 9223372036854775807);
static_assert(__UINT8_MAX__ == 255U);
static_assert(__UINT16_MAX__ == 65535U);
static_assert(__UINT32_MAX__ == 4294967295U);
static_assert(__UINT64_MAX__ == 18446744073709551615U);

export struct ssc__core__type__undefined {};
export struct ssc__core__type__null {};
export using ssc__core__type__boolean = bool;
export using ssc__core__type__i8 = __INT8_TYPE__;
export using ssc__core__type__i16 = __INT16_TYPE__;
export using ssc__core__type__i32 = __INT32_TYPE__;
export using ssc__core__type__i64 = __INT64_TYPE__;
export using ssc__core__type__u8 = __UINT8_TYPE__;
export using ssc__core__type__u16 = __UINT16_TYPE__;
export using ssc__core__type__u32 = __UINT32_TYPE__;
export using ssc__core__type__u64 = __UINT64_TYPE__;
export using ssc__core__type__char = char32_t;
export using ssc__core__type__f32 = float;
export using ssc__core__type__f64 = double;

export template <typename Type> struct ssc__core__struct__span {
  ssc__core__type__u64 ssc__core__member__length;
  const Type* ssc__core__member__elements_pointer;

  inline const Type* begin() const noexcept {
    return ssc__core__member__elements_pointer;
  }

  inline const Type* end() const noexcept {
    return ssc__core__member__elements_pointer + ssc__core__member__length;
  }
};

export struct ssc__core__struct__object_header {
  ssc__core__type__u64 ssc__core__member__rc;
  const ssc__core__struct__descriptor* ssc__core__member__descriptor_pointer;
};

export struct ssc__core__struct__shape {
  ssc__core__struct__span<ssc__core__type__u64> ssc__core__member__ref_offsets;
  ssc__core__struct__span<ssc__core__type__u64> ssc__core__member__union_offsets;
};

export struct ssc__core__struct__descriptor {
  const ssc__core__struct__shape* ssc__core__member__shape_pointer;
};

export struct ssc__core__struct__string {
  ssc__core__struct__object_header ssc__core__member__object_header;
  ssc__core__type__u64 ssc__core__member__length;
  ssc__core__type__u8 ssc__core__member__bytes[];
};

export class [[clang::trivial_abi]] ssc__core__type__ref {
private:
  ssc__core__struct__object_header* ssc__core__member__object_header_pointer;

public:
  inline explicit ssc__core__type__ref(ssc__core__struct__object_header* object_header_pointer) noexcept : ssc__core__member__object_header_pointer(object_header_pointer) {}

  inline ssc__core__type__ref(const ssc__core__type__ref& other) noexcept : ssc__core__member__object_header_pointer(other.ssc__core__member__object_header_pointer) {
    ssc__core__fn__clone_rc(ssc__core__member__object_header_pointer);
  }

  inline ssc__core__type__ref(ssc__core__type__ref&& other) noexcept : ssc__core__member__object_header_pointer(other.ssc__core__member__object_header_pointer) {
    other.ssc__core__member__object_header_pointer = nullptr;
  }

  inline ~ssc__core__type__ref() noexcept {
    ssc__core__fn__drop_rc(ssc__core__member__object_header_pointer);
  }

  inline ssc__core__type__ref& operator=(const ssc__core__type__ref& other) noexcept {
    ssc__core__struct__object_header* object_header_pointer = other.ssc__core__member__object_header_pointer;
    ssc__core__fn__clone_rc(object_header_pointer);
    ssc__core__fn__drop_rc(ssc__core__member__object_header_pointer);
    ssc__core__member__object_header_pointer = object_header_pointer;
    return *this;
  }

  inline ssc__core__type__ref& operator=(ssc__core__type__ref&& other) noexcept {
    ssc__core__struct__object_header* object_header_pointer = other.ssc__core__member__object_header_pointer;
    other.ssc__core__member__object_header_pointer = nullptr;
    ssc__core__fn__drop_rc(ssc__core__member__object_header_pointer);
    ssc__core__member__object_header_pointer = object_header_pointer;
    return *this;
  }

  inline ssc__core__struct__object_header* operator->() const noexcept {
    return ssc__core__member__get_object_header_pointer();
  }

  inline ssc__core__struct__object_header* ssc__core__member__get_object_header_pointer() const noexcept {
    return ssc__core__member__object_header_pointer;
  }

  inline ssc__core__struct__object_header* ssc__core__member__detach() noexcept {
    ssc__core__struct__object_header* object_header_pointer = ssc__core__member__object_header_pointer;
    ssc__core__member__object_header_pointer = nullptr;
    return object_header_pointer;
  }
};

// 0: uninitialized
export template <typename Type> constexpr ssc__core__type__u64 ssc__core__var__type_id = 0;
// 1 ~ 15: undefined, null
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__undefined> = 1;
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__null> = 2;
// 16 ~ 31: boolean, integer
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__boolean> = 16;
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__i8> = 17;
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__i16> = 18;
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__i32> = 19;
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__i64> = 20;
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__u8> = 21;
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__u16> = 22;
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__u32> = 23;
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__u64> = 24;
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__char> = 25;
// 32 ~ 47: float
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__f32> = 32;
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__f64> = 33;
// 48: ref
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__ref> = 48;
// 49 ~ 255: reserved
// 256 ~: user
;

export struct [[clang::trivial_abi]] ssc__core__type__union {
private:
  inline bool ssc__core__member__is_ref() const noexcept {
    return ssc__core__member__type_id == ssc__core__var__type_id<ssc__core__type__ref>;
  }

  inline void ssc__core__member__clone_rc() const noexcept {
    if (ssc__core__member__is_ref()) {
      ssc__core__fn__clone_rc(ssc__core__member__value.ssc__core__member__object_header_pointer);
    }
  }

  inline void ssc__core__member__drop_rc() noexcept {
    if (ssc__core__member__is_ref()) {
      ssc__core__fn__drop_rc(ssc__core__member__value.ssc__core__member__object_header_pointer);
    }
  }

public:
  ssc__core__type__u64 ssc__core__member__type_id;
  union {
    ssc__core__type__undefined ssc__core__member__undefined;
    ssc__core__type__null ssc__core__member__null;
    ssc__core__type__boolean ssc__core__member__boolean;
    ssc__core__type__i8 ssc__core__member__i8;
    ssc__core__type__i16 ssc__core__member__i16;
    ssc__core__type__i32 ssc__core__member__i32;
    ssc__core__type__i64 ssc__core__member__i64;
    ssc__core__type__u8 ssc__core__member__u8;
    ssc__core__type__u16 ssc__core__member__u16;
    ssc__core__type__u32 ssc__core__member__u32;
    ssc__core__type__u64 ssc__core__member__u64;
    ssc__core__type__char ssc__core__member__char;
    ssc__core__type__f32 ssc__core__member__f32;
    ssc__core__type__f64 ssc__core__member__f64;
    ssc__core__struct__object_header* ssc__core__member__object_header_pointer;
  } ssc__core__member__value;

  template <typename Type>
    requires(ssc__core__var__type_id<Type> != 0)
  inline ssc__core__type__union(Type value) noexcept : ssc__core__member__type_id(ssc__core__var__type_id<Type>) {
    if constexpr (ssc__core__var__type_id<Type> == ssc__core__var__type_id<ssc__core__type__ref>) {
      ssc__core__member__value.ssc__core__member__object_header_pointer = value.ssc__core__member__detach();
    } else {
      __builtin_memcpy(__builtin_addressof(ssc__core__member__value), __builtin_addressof(value), sizeof(Type));
    }
  }

  inline ssc__core__type__union(const ssc__core__type__union& other) noexcept : ssc__core__member__type_id(other.ssc__core__member__type_id), ssc__core__member__value(other.ssc__core__member__value) {
    ssc__core__member__clone_rc();
  }

  inline ssc__core__type__union(ssc__core__type__union&& other) noexcept : ssc__core__member__type_id(other.ssc__core__member__type_id), ssc__core__member__value(other.ssc__core__member__value) {
    other.ssc__core__member__type_id = 0;
  }

  inline ~ssc__core__type__union() noexcept {
    ssc__core__member__drop_rc();
  }

  inline ssc__core__type__union& operator=(const ssc__core__type__union& other) noexcept {
    ssc__core__type__u64 type_id = other.ssc__core__member__type_id;
    decltype(ssc__core__member__value) value = other.ssc__core__member__value;
    other.ssc__core__member__clone_rc();
    ssc__core__member__drop_rc();
    ssc__core__member__type_id = type_id;
    ssc__core__member__value = value;
    return *this;
  }

  inline ssc__core__type__union& operator=(ssc__core__type__union&& other) noexcept {
    ssc__core__type__u64 type_id = other.ssc__core__member__type_id;
    decltype(ssc__core__member__value) value = other.ssc__core__member__value;
    other.ssc__core__member__type_id = 0;
    ssc__core__member__drop_rc();
    ssc__core__member__type_id = type_id;
    ssc__core__member__value = value;
    return *this;
  }
};

template <typename Type> inline Type* ssc__core__fn__pointer_field_at(ssc__core__struct__object_header* object_header_pointer, ssc__core__type__u64 offset) noexcept {
  return reinterpret_cast<Type*>(reinterpret_cast<ssc__core__type__u8*>(object_header_pointer) + offset);
}

export inline void ssc__core__fn__clone_rc(ssc__core__struct__object_header* object_header_pointer) noexcept {
  if (object_header_pointer && object_header_pointer->ssc__core__member__rc != 0) {
    object_header_pointer->ssc__core__member__rc++;
  }
}

export inline void ssc__core__fn__drop_rc(ssc__core__struct__object_header* object_header_pointer) noexcept {
  if (object_header_pointer && object_header_pointer->ssc__core__member__rc != 0 && --object_header_pointer->ssc__core__member__rc == 0) {
    const ssc__core__struct__shape* shape_pointer = object_header_pointer->ssc__core__member__descriptor_pointer->ssc__core__member__shape_pointer;

    for (const ssc__core__type__u64 offset : shape_pointer->ssc__core__member__ref_offsets) {
      ssc__core__fn__pointer_field_at<ssc__core__type__ref>(object_header_pointer, offset)->~ssc__core__type__ref();
    }

    for (const ssc__core__type__u64 offset : shape_pointer->ssc__core__member__union_offsets) {
      ssc__core__fn__pointer_field_at<ssc__core__type__union>(object_header_pointer, offset)->~ssc__core__type__union();
    }

    free(object_header_pointer);
  }
}

static_assert(sizeof(ssc__core__type__undefined) == 1);
static_assert(sizeof(ssc__core__type__null) == 1);
static_assert(sizeof(ssc__core__type__boolean) == 1);
static_assert(sizeof(ssc__core__type__i8) == 1);
static_assert(sizeof(ssc__core__type__i16) == 2);
static_assert(sizeof(ssc__core__type__i32) == 4);
static_assert(sizeof(ssc__core__type__i64) == 8);
static_assert(sizeof(ssc__core__type__u8) == 1);
static_assert(sizeof(ssc__core__type__u16) == 2);
static_assert(sizeof(ssc__core__type__u32) == 4);
static_assert(sizeof(ssc__core__type__u64) == 8);
static_assert(sizeof(ssc__core__type__char) == 4);
static_assert(sizeof(ssc__core__type__f32) == 4);
static_assert(sizeof(ssc__core__type__f64) == 8);
static_assert(sizeof(ssc__core__struct__string) == 24);
static_assert(sizeof(ssc__core__type__ref) == 8);
static_assert(sizeof(ssc__core__type__union) == 16);
static_assert(sizeof(ssc__core__struct__object_header) == 16);
static_assert(sizeof(ssc__core__struct__shape) == 32);
static_assert(sizeof(ssc__core__struct__descriptor) == 8);

export inline constexpr ssc__core__type__undefined ssc__core__var__undefined{};
export inline constexpr ssc__core__type__null ssc__core__var__null{};

export inline constexpr ssc__core__struct__shape ssc__core__var__string_shape{};
export inline constexpr ssc__core__struct__descriptor ssc__core__var__string_descriptor{__builtin_addressof(ssc__core__var__string_shape)};

export inline ssc__core__type__boolean ssc__core__fn__truthy_f32(ssc__core__type__f32 value) noexcept {
  return !__builtin_isnan(value) && value != 0;
}

export inline ssc__core__type__boolean ssc__core__fn__truthy_f64(ssc__core__type__f64 value) noexcept {
  return !__builtin_isnan(value) && value != 0;
}

export inline ssc__core__type__boolean ssc__core__fn__truthy_union(const ssc__core__type__union& value) noexcept {
  const ssc__core__type__u64 type_id = value.ssc__core__member__type_id;
  const auto& member = value.ssc__core__member__value;

  if (type_id == ssc__core__var__type_id<ssc__core__type__undefined>) {
    return false;
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__null>) {
    return false;
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__boolean>) {
    return member.ssc__core__member__boolean;
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i8>) {
    return member.ssc__core__member__i8 != 0;
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i16>) {
    return member.ssc__core__member__i16 != 0;
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i32>) {
    return member.ssc__core__member__i32 != 0;
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i64>) {
    return member.ssc__core__member__i64 != 0;
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u8>) {
    return member.ssc__core__member__u8 != 0;
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u16>) {
    return member.ssc__core__member__u16 != 0;
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u32>) {
    return member.ssc__core__member__u32 != 0;
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u64>) {
    return member.ssc__core__member__u64 != 0;
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__char>) {
    return member.ssc__core__member__char != 0;
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__f32>) {
    return ssc__core__fn__truthy_f32(member.ssc__core__member__f32);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__f64>) {
    return ssc__core__fn__truthy_f64(member.ssc__core__member__f64);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__ref>) {
    const ssc__core__struct__object_header* object_header_pointer = member.ssc__core__member__object_header_pointer;

    if (object_header_pointer->ssc__core__member__descriptor_pointer != __builtin_addressof(ssc__core__var__string_descriptor)) {
      return true;
    }

    return reinterpret_cast<const ssc__core__struct__string*>(object_header_pointer)->ssc__core__member__length != 0;
  }

  __builtin_trap();
}

export inline void ssc__core__fn__write_stdout(ssc__core__type__ref string) noexcept {
  const ssc__core__struct__string* string_pointer = reinterpret_cast<const ssc__core__struct__string*>(string.ssc__core__member__get_object_header_pointer());
  std::cout.write(reinterpret_cast<const char*>(string_pointer->ssc__core__member__bytes), string_pointer->ssc__core__member__length);
}

export inline void ssc__core__fn__write_stderr(ssc__core__type__ref string) noexcept {
  const ssc__core__struct__string* string_pointer = reinterpret_cast<const ssc__core__struct__string*>(string.ssc__core__member__get_object_header_pointer());
  std::cerr.write(reinterpret_cast<const char*>(string_pointer->ssc__core__member__bytes), string_pointer->ssc__core__member__length);
}

export inline void ssc__core__fn__write_stdout(std::string_view string_view) noexcept {
  std::cout.write(string_view.data(), string_view.size());
}

export inline void ssc__core__fn__write_stderr(std::string_view string_view) noexcept {
  std::cerr.write(string_view.data(), string_view.size());
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_tdz_error(const char* var_name_pointer) {
  throw std::string("ReferenceError: Cannot access '") + var_name_pointer + "' before initialization";
}

export inline void ssc__core__fn__throw_if_tdz(ssc__core__type__boolean is_initialized, const char* var_name_pointer) {
  if (!is_initialized) [[unlikely]] {
    ssc__core__fn__throw_tdz_error(var_name_pointer);
  }
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_overflow_error(const char* type_name_pointer) {
  throw std::string("RangeError: Overflow: ") + type_name_pointer;
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_division_by_zero_error(const char* type_name_pointer) {
  throw std::string("RangeError: Division by zero: ") + type_name_pointer;
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__add(Type left, Type right, const char* type_name_pointer) {
  Type result;
  if (__builtin_add_overflow(left, right, __builtin_addressof(result))) [[unlikely]] {
    ssc__core__fn__throw_overflow_error(type_name_pointer);
  }
  return result;
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__sub(Type left, Type right, const char* type_name_pointer) {
  Type result;
  if (__builtin_sub_overflow(left, right, __builtin_addressof(result))) [[unlikely]] {
    ssc__core__fn__throw_overflow_error(type_name_pointer);
  }
  return result;
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__mul(Type left, Type right, const char* type_name_pointer) {
  Type result;
  if (__builtin_mul_overflow(left, right, __builtin_addressof(result))) [[unlikely]] {
    ssc__core__fn__throw_overflow_error(type_name_pointer);
  }
  return result;
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__div(Type left, Type right, const char* type_name_pointer) {
  if (right == 0) [[unlikely]] {
    ssc__core__fn__throw_division_by_zero_error(type_name_pointer);
  }
  if constexpr (static_cast<Type>(-1) < 0) {
    if (right == -1) [[unlikely]] {
      return ssc__core__fn__sub(static_cast<Type>(0), left, type_name_pointer);
    }
  }
  return static_cast<Type>(left / right);
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__rem(Type left, Type right, const char* type_name_pointer) {
  if (right == 0) [[unlikely]] {
    ssc__core__fn__throw_division_by_zero_error(type_name_pointer);
  }
  if constexpr (static_cast<Type>(-1) < 0) {
    if (right == -1) [[unlikely]] {
      return 0;
    }
  }
  return static_cast<Type>(left % right);
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_shift_count_error(const char* type_name_pointer) {
  throw std::string("RangeError: Shift count out of range: ") + type_name_pointer;
}

template <typename Type> inline void ssc__core__fn__check_shift_count(Type count, const char* type_name_pointer) {
  if constexpr (static_cast<Type>(-1) < 0) {
    if (count < 0) [[unlikely]] {
      ssc__core__fn__throw_shift_count_error(type_name_pointer);
    }
  }
  if (static_cast<ssc__core__type__u64>(count) >= sizeof(Type) * __CHAR_BIT__) [[unlikely]] {
    ssc__core__fn__throw_shift_count_error(type_name_pointer);
  }
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__bitwise_and(Type left, Type right) {
  return static_cast<Type>(left & right);
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__bitwise_or(Type left, Type right) {
  return static_cast<Type>(left | right);
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__bitwise_xor(Type left, Type right) {
  return static_cast<Type>(left ^ right);
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__shift_left(Type left, Type right, const char* type_name_pointer) {
  ssc__core__fn__check_shift_count(right, type_name_pointer);
  return static_cast<Type>(static_cast<__make_unsigned(Type)>(left) << right);
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__shift_right(Type left, Type right, const char* type_name_pointer) {
  ssc__core__fn__check_shift_count(right, type_name_pointer);
  return static_cast<Type>(left >> right);
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__unsigned_shift_right(Type left, Type right, const char* type_name_pointer) {
  ssc__core__fn__check_shift_count(right, type_name_pointer);
  return static_cast<Type>(static_cast<__make_unsigned(Type)>(left) >> right);
}
