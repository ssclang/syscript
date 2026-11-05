export module ssc;

import std;

extern "C" void* malloc(__SIZE_TYPE__ size) noexcept;
extern "C" void* realloc(void* pointer, __SIZE_TYPE__ size) noexcept;
extern "C" void free(void* pointer) noexcept;

export struct ssc__core__struct__object_header;
export class ssc__core__type__ref;
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
export using ssc__core__type__void = void;
export using ssc__core__type__boolean = bool;
export using ssc__core__type__i8 = __INT8_TYPE__;
export using ssc__core__type__i16 = __INT16_TYPE__;
export using ssc__core__type__i32 = __INT32_TYPE__;
export using ssc__core__type__i64 = __INT64_TYPE__;
export using ssc__core__type__u8 = __UINT8_TYPE__;
export using ssc__core__type__u16 = __UINT16_TYPE__;
export using ssc__core__type__u32 = __UINT32_TYPE__;
export using ssc__core__type__u64 = __UINT64_TYPE__;
export using ssc__core__type__char = __UINT32_TYPE__;
export using ssc__core__type__f32 = float;
export using ssc__core__type__f64 = double;

export struct ssc__core__type__number {
  ssc__core__type__f64 ssc__core__member__value;

  ssc__core__type__number() = default;

  inline explicit constexpr ssc__core__type__number(ssc__core__type__f64 value) noexcept : ssc__core__member__value(value) {}

  inline explicit constexpr operator ssc__core__type__f64() const noexcept {
    return ssc__core__member__value;
  }

  inline constexpr ssc__core__type__number operator+(ssc__core__type__number right) const noexcept {
    return ssc__core__type__number(ssc__core__member__value + right.ssc__core__member__value);
  }

  inline constexpr ssc__core__type__number operator-(ssc__core__type__number right) const noexcept {
    return ssc__core__type__number(ssc__core__member__value - right.ssc__core__member__value);
  }

  inline constexpr ssc__core__type__number operator*(ssc__core__type__number right) const noexcept {
    return ssc__core__type__number(ssc__core__member__value * right.ssc__core__member__value);
  }

  inline constexpr ssc__core__type__number operator/(ssc__core__type__number right) const noexcept {
    return ssc__core__type__number(ssc__core__member__value / right.ssc__core__member__value);
  }

  inline ssc__core__type__number operator%(ssc__core__type__number right) const noexcept {
    return ssc__core__type__number(__builtin_fmod(ssc__core__member__value, right.ssc__core__member__value));
  }

  inline constexpr ssc__core__type__number operator-() const noexcept {
    return ssc__core__type__number(-ssc__core__member__value);
  }

  inline constexpr ssc__core__type__number operator+() const noexcept {
    return *this;
  }

  inline constexpr ssc__core__type__boolean operator==(const ssc__core__type__number& right) const noexcept = default;

  inline constexpr auto operator<=>(const ssc__core__type__number& right) const noexcept = default;

  inline ssc__core__type__number& operator+=(ssc__core__type__number right) noexcept {
    *this = *this + right;
    return *this;
  }

  inline ssc__core__type__number& operator-=(ssc__core__type__number right) noexcept {
    *this = *this - right;
    return *this;
  }

  inline ssc__core__type__number& operator*=(ssc__core__type__number right) noexcept {
    *this = *this * right;
    return *this;
  }

  inline ssc__core__type__number& operator/=(ssc__core__type__number right) noexcept {
    *this = *this / right;
    return *this;
  }

  inline ssc__core__type__number& operator%=(ssc__core__type__number right) noexcept {
    *this = *this % right;
    return *this;
  }

  inline ssc__core__type__number& operator++() noexcept {
    *this = *this + ssc__core__type__number(1.0);
    return *this;
  }

  inline ssc__core__type__number operator++(int) noexcept {
    const ssc__core__type__number previous = *this;
    *this = previous + ssc__core__type__number(1.0);
    return previous;
  }

  inline ssc__core__type__number& operator--() noexcept {
    *this = *this - ssc__core__type__number(1.0);
    return *this;
  }

  inline ssc__core__type__number operator--(int) noexcept {
    const ssc__core__type__number previous = *this;
    *this = previous - ssc__core__type__number(1.0);
    return previous;
  }
};

export template <typename Type> struct ssc__core__struct__span {
  ssc__core__type__u64 ssc__core__member__length;
  const Type* ssc__core__member__elements_pointer;

  inline const Type* begin() const noexcept {
    return ssc__core__member__elements_pointer;
  }

  inline const Type* end() const noexcept {
    return ssc__core__member__elements_pointer + ssc__core__member__length;
  }

  inline const Type& operator[](ssc__core__type__u64 index) const noexcept {
    return ssc__core__member__elements_pointer[index];
  }
};

export struct ssc__core__struct__object_header {
  ssc__core__type__u64 ssc__core__member__rc;
  const ssc__core__struct__descriptor* ssc__core__member__descriptor_pointer;
};

export struct ssc__core__struct__property {
  const char* ssc__core__member__name;
  ssc__core__type__u64 ssc__core__member__offset;
  ssc__core__type__u64 ssc__core__member__kind;
};

export struct ssc__core__struct__shape {
  ssc__core__struct__span<ssc__core__type__u64> ssc__core__member__ref_offsets;
  ssc__core__struct__span<ssc__core__type__u64> ssc__core__member__union_offsets;
  ssc__core__struct__span<ssc__core__struct__property> ssc__core__member__properties;
  ssc__core__type__u64 ssc__core__member__id;
};

export struct ssc__core__struct__descriptor {
  const ssc__core__struct__shape* ssc__core__member__shape_pointer;
  void (*ssc__core__member__destroy_pointer)(ssc__core__struct__object_header* object_header_pointer);
  ssc__core__type__ref (*ssc__core__member__to_string_pointer)(const ssc__core__type__ref& value);
  ssc__core__type__ref (*ssc__core__member__inspect_pointer)(const ssc__core__type__ref& value);
  ssc__core__struct__span<ssc__core__type__u64> ssc__core__member__keys;
  const char* ssc__core__member__class_name;
};

export struct ssc__core__struct__bstring {
  ssc__core__struct__object_header ssc__core__member__object_header;
  ssc__core__type__u64 ssc__core__member__length;
  ssc__core__type__u8 ssc__core__member__bytes[];
};

export struct ssc__core__struct__string {
  ssc__core__struct__object_header ssc__core__member__object_header;
  ssc__core__type__u64 ssc__core__member__length;
  ssc__core__type__u16 ssc__core__member__units[];
};

export class [[clang::trivial_abi]] ssc__core__type__ref {
private:
  ssc__core__struct__object_header* ssc__core__member__object_header_pointer;

public:
  inline ssc__core__type__ref() noexcept : ssc__core__member__object_header_pointer(nullptr) {}

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
// 32 ~ 47: float
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__f32> = 32;
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__f64> = 33;
export template <> constexpr ssc__core__type__u64 ssc__core__var__type_id<ssc__core__type__number> = 34;
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
    ssc__core__type__f32 ssc__core__member__f32;
    ssc__core__type__f64 ssc__core__member__f64;
    ssc__core__type__number ssc__core__member__number;
    ssc__core__struct__object_header* ssc__core__member__object_header_pointer;
  } ssc__core__member__value;

  inline ssc__core__type__union() noexcept : ssc__core__member__type_id(0) {}

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
    const ssc__core__struct__descriptor* descriptor_pointer = object_header_pointer->ssc__core__member__descriptor_pointer;
    const ssc__core__struct__shape* shape_pointer = descriptor_pointer->ssc__core__member__shape_pointer;

    if (descriptor_pointer->ssc__core__member__destroy_pointer) {
      descriptor_pointer->ssc__core__member__destroy_pointer(object_header_pointer);
    }

    for (const ssc__core__type__u64 offset : shape_pointer->ssc__core__member__ref_offsets) {
      std::destroy_at(ssc__core__fn__pointer_field_at<ssc__core__type__ref>(object_header_pointer, offset));
    }

    for (const ssc__core__type__u64 offset : shape_pointer->ssc__core__member__union_offsets) {
      std::destroy_at(ssc__core__fn__pointer_field_at<ssc__core__type__union>(object_header_pointer, offset));
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
static_assert(sizeof(ssc__core__type__f32) == 4);
static_assert(sizeof(ssc__core__type__f64) == 8);
static_assert(sizeof(ssc__core__type__number) == 8);
static_assert(sizeof(ssc__core__struct__bstring) == 24);
static_assert(sizeof(ssc__core__struct__string) == 24);
static_assert(sizeof(ssc__core__type__ref) == 8);
static_assert(sizeof(ssc__core__type__union) == 16);
static_assert(sizeof(ssc__core__struct__object_header) == 16);
static_assert(sizeof(ssc__core__struct__shape) == 56);
static_assert(sizeof(ssc__core__struct__descriptor) == 56);

export inline constexpr ssc__core__type__undefined ssc__core__var__undefined{};
export inline constexpr ssc__core__type__null ssc__core__var__null{};

export inline constexpr ssc__core__struct__shape ssc__core__var__bstring_shape{};
export inline constexpr ssc__core__struct__descriptor ssc__core__var__bstring_descriptor{__builtin_addressof(ssc__core__var__bstring_shape)};

export template <ssc__core__type__u64 Size> struct ssc__core__struct__bstring_literal {
  ssc__core__struct__object_header ssc__core__member__object_header;
  ssc__core__type__u64 ssc__core__member__length;
  ssc__core__type__u8 ssc__core__member__bytes[Size];

  consteval ssc__core__struct__bstring_literal(const char8_t (&bytes)[Size]) noexcept : ssc__core__member__object_header{0, __builtin_addressof(ssc__core__var__bstring_descriptor)}, ssc__core__member__length(Size - 1), ssc__core__member__bytes{} {
    for (ssc__core__type__u64 index = 0; index < Size; index++) {
      ssc__core__member__bytes[index] = bytes[index];
    }
  }
};

export template <ssc__core__struct__bstring_literal Text> inline ssc__core__type__ref ssc__core__fn__bstring_literal() noexcept {
  return ssc__core__type__ref(const_cast<ssc__core__struct__object_header*>(__builtin_addressof(Text.ssc__core__member__object_header)));
}

export inline constexpr ssc__core__struct__shape ssc__core__var__string_shape{};
export inline constexpr ssc__core__struct__descriptor ssc__core__var__string_descriptor{__builtin_addressof(ssc__core__var__string_shape)};

export template <ssc__core__type__u64 Size> struct ssc__core__struct__string_literal {
  ssc__core__struct__object_header ssc__core__member__object_header;
  ssc__core__type__u64 ssc__core__member__length;
  ssc__core__type__u16 ssc__core__member__units[Size];

  consteval ssc__core__struct__string_literal(const char16_t (&units)[Size]) noexcept : ssc__core__member__object_header{0, __builtin_addressof(ssc__core__var__string_descriptor)}, ssc__core__member__length(Size - 1), ssc__core__member__units{} {
    for (ssc__core__type__u64 index = 0; index < Size; index++) {
      ssc__core__member__units[index] = units[index];
    }
  }
};

export template <ssc__core__struct__string_literal Text> inline ssc__core__type__ref ssc__core__fn__string_literal() noexcept {
  return ssc__core__type__ref(const_cast<ssc__core__struct__object_header*>(__builtin_addressof(Text.ssc__core__member__object_header)));
}

export struct ssc__core__struct__box {
  ssc__core__struct__object_header ssc__core__member__object_header;
  ssc__core__type__union ssc__core__member__value;
};

inline constexpr ssc__core__type__u64 ssc__core__var__box_union_offsets[] = {__builtin_offsetof(ssc__core__struct__box, ssc__core__member__value)};
inline constexpr ssc__core__struct__shape ssc__core__var__box_shape{{}, {1, ssc__core__var__box_union_offsets}};
inline constexpr ssc__core__struct__descriptor ssc__core__var__box_descriptor{__builtin_addressof(ssc__core__var__box_shape)};

export inline ssc__core__type__ref ssc__core__fn__box(ssc__core__type__union value) {
  void* pointer = malloc(sizeof(ssc__core__struct__box));

  if (!pointer) [[unlikely]] {
    __builtin_trap();
  }

  ssc__core__struct__box* box_pointer = static_cast<ssc__core__struct__box*>(pointer);
  box_pointer->ssc__core__member__object_header = {1, __builtin_addressof(ssc__core__var__box_descriptor)};
  std::construct_at(__builtin_addressof(box_pointer->ssc__core__member__value), static_cast<ssc__core__type__union&&>(value));

  return ssc__core__type__ref(__builtin_addressof(box_pointer->ssc__core__member__object_header));
}

export inline ssc__core__type__union& ssc__core__fn__box_value(const ssc__core__type__ref& box) noexcept {
  return reinterpret_cast<ssc__core__struct__box*>(box.ssc__core__member__get_object_header_pointer())->ssc__core__member__value;
}

export struct ssc__core__struct__closure {
  ssc__core__struct__object_header ssc__core__member__object_header;
  ssc__core__type__union (*ssc__core__member__function)(const ssc__core__struct__closure* closure, ssc__core__struct__span<ssc__core__type__union> arguments);
  ssc__core__struct__span<ssc__core__type__ref> ssc__core__member__captures;
};

inline void ssc__core__fn__closure_destroy(ssc__core__struct__object_header* object_header_pointer) noexcept {
  for (const ssc__core__type__ref& capture : reinterpret_cast<ssc__core__struct__closure*>(object_header_pointer)->ssc__core__member__captures) {
    std::destroy_at(const_cast<ssc__core__type__ref*>(__builtin_addressof(capture)));
  }
}

inline ssc__core__type__ref ssc__core__fn__closure_to_string(const ssc__core__type__ref&) {
  return ssc__core__fn__string_literal<u"[Function]">();
}

inline constexpr ssc__core__struct__shape ssc__core__var__closure_shape{};
export inline constexpr ssc__core__struct__descriptor ssc__core__var__closure_descriptor{__builtin_addressof(ssc__core__var__closure_shape), ssc__core__fn__closure_destroy, ssc__core__fn__closure_to_string, ssc__core__fn__closure_to_string};

export inline ssc__core__type__ref ssc__core__fn__closure(decltype(ssc__core__struct__closure::ssc__core__member__function) function, std::initializer_list<ssc__core__type__ref> captures) {
  void* pointer = malloc(sizeof(ssc__core__struct__closure) + captures.size() * sizeof(ssc__core__type__ref));

  if (!pointer) [[unlikely]] {
    __builtin_trap();
  }

  ssc__core__struct__closure* closure_pointer = static_cast<ssc__core__struct__closure*>(pointer);
  ssc__core__type__ref* captures_pointer = reinterpret_cast<ssc__core__type__ref*>(closure_pointer + 1);
  ssc__core__type__u64 index = 0;

  for (const ssc__core__type__ref& capture : captures) {
    std::construct_at(captures_pointer + index++, capture);
  }

  closure_pointer->ssc__core__member__object_header = {1, __builtin_addressof(ssc__core__var__closure_descriptor)};
  closure_pointer->ssc__core__member__function = function;
  closure_pointer->ssc__core__member__captures = {captures.size(), captures_pointer};

  return ssc__core__type__ref(__builtin_addressof(closure_pointer->ssc__core__member__object_header));
}

export inline ssc__core__type__ref ssc__core__fn__function_value(const ssc__core__struct__closure& closure) noexcept {
  return ssc__core__type__ref(const_cast<ssc__core__struct__object_header*>(__builtin_addressof(closure.ssc__core__member__object_header)));
}

inline ssc__core__type__union ssc__core__fn__call_span(const ssc__core__type__ref& function, ssc__core__struct__span<ssc__core__type__union> arguments) {
  const ssc__core__struct__closure* closure_pointer = reinterpret_cast<const ssc__core__struct__closure*>(function.ssc__core__member__get_object_header_pointer());

  return closure_pointer->ssc__core__member__function(closure_pointer, arguments);
}

export inline ssc__core__type__union ssc__core__fn__call(const ssc__core__type__ref& function, std::initializer_list<ssc__core__type__union> arguments) {
  return ssc__core__fn__call_span(function, {arguments.size(), arguments.begin()});
}

inline const ssc__core__struct__bstring* ssc__core__fn__get_bstring_pointer(const ssc__core__type__ref& string) noexcept {
  return reinterpret_cast<const ssc__core__struct__bstring*>(string.ssc__core__member__get_object_header_pointer());
}

export inline ssc__core__type__u64 ssc__core__fn__bstring_length(const ssc__core__type__ref& string) noexcept {
  return ssc__core__fn__get_bstring_pointer(string)->ssc__core__member__length;
}

export inline ssc__core__type__i32 ssc__core__fn__bstring_compare(const ssc__core__type__ref& left, const ssc__core__type__ref& right) noexcept {
  const ssc__core__struct__bstring* left_pointer = ssc__core__fn__get_bstring_pointer(left);
  const ssc__core__struct__bstring* right_pointer = ssc__core__fn__get_bstring_pointer(right);
  const ssc__core__type__u64 left_length = left_pointer->ssc__core__member__length;
  const ssc__core__type__u64 right_length = right_pointer->ssc__core__member__length;
  const ssc__core__type__i32 result = __builtin_memcmp(left_pointer->ssc__core__member__bytes, right_pointer->ssc__core__member__bytes, left_length < right_length ? left_length : right_length);

  if (result != 0) {
    return result;
  }

  if (left_length == right_length) {
    return 0;
  }

  return left_length < right_length ? -1 : 1;
}

inline ssc__core__type__boolean ssc__core__fn__bstring_bytes_equals(const ssc__core__struct__bstring* left_pointer, const ssc__core__struct__bstring* right_pointer) noexcept {
  if (left_pointer->ssc__core__member__length != right_pointer->ssc__core__member__length) {
    return false;
  }

  return __builtin_memcmp(left_pointer->ssc__core__member__bytes, right_pointer->ssc__core__member__bytes, left_pointer->ssc__core__member__length) == 0;
}

inline ssc__core__type__ref ssc__core__fn__allocate_bstring(ssc__core__type__u64 length) {
  void* pointer = malloc(sizeof(ssc__core__struct__bstring) + length + 1);

  if (!pointer) [[unlikely]] {
    __builtin_trap();
  }

  ssc__core__struct__bstring* string_pointer = static_cast<ssc__core__struct__bstring*>(pointer);
  string_pointer->ssc__core__member__object_header = {1, __builtin_addressof(ssc__core__var__bstring_descriptor)};
  string_pointer->ssc__core__member__length = length;
  string_pointer->ssc__core__member__bytes[length] = 0;

  return ssc__core__type__ref(__builtin_addressof(string_pointer->ssc__core__member__object_header));
}

export inline ssc__core__type__ref ssc__core__fn__bstring_concat(const ssc__core__type__ref& left, const ssc__core__type__ref& right) {
  const ssc__core__struct__bstring* left_pointer = ssc__core__fn__get_bstring_pointer(left);
  const ssc__core__struct__bstring* right_pointer = ssc__core__fn__get_bstring_pointer(right);
  const ssc__core__type__u64 left_length = left_pointer->ssc__core__member__length;
  const ssc__core__type__u64 right_length = right_pointer->ssc__core__member__length;
  ssc__core__type__ref result = ssc__core__fn__allocate_bstring(left_length + right_length);
  ssc__core__struct__bstring* result_pointer = reinterpret_cast<ssc__core__struct__bstring*>(result.ssc__core__member__get_object_header_pointer());

  __builtin_memcpy(result_pointer->ssc__core__member__bytes, left_pointer->ssc__core__member__bytes, left_length);
  __builtin_memcpy(result_pointer->ssc__core__member__bytes + left_length, right_pointer->ssc__core__member__bytes, right_length);

  return result;
}

inline ssc__core__type__ref ssc__core__fn__bstring_from_bytes(const char* pointer, ssc__core__type__u64 length) {
  ssc__core__type__ref result = ssc__core__fn__allocate_bstring(length);

  __builtin_memcpy(reinterpret_cast<ssc__core__struct__bstring*>(result.ssc__core__member__get_object_header_pointer())->ssc__core__member__bytes, pointer, length);

  return result;
}

inline const ssc__core__struct__string* ssc__core__fn__get_string_pointer(const ssc__core__type__ref& string) noexcept {
  return reinterpret_cast<const ssc__core__struct__string*>(string.ssc__core__member__get_object_header_pointer());
}

export inline ssc__core__type__number ssc__core__fn__string_length(const ssc__core__type__ref& string) noexcept {
  return ssc__core__type__number(static_cast<ssc__core__type__f64>(ssc__core__fn__get_string_pointer(string)->ssc__core__member__length));
}

export inline ssc__core__type__i32 ssc__core__fn__string_compare(const ssc__core__type__ref& left, const ssc__core__type__ref& right) noexcept {
  const ssc__core__struct__string* left_pointer = ssc__core__fn__get_string_pointer(left);
  const ssc__core__struct__string* right_pointer = ssc__core__fn__get_string_pointer(right);
  const ssc__core__type__u64 left_length = left_pointer->ssc__core__member__length;
  const ssc__core__type__u64 right_length = right_pointer->ssc__core__member__length;
  const ssc__core__type__u64 length = left_length < right_length ? left_length : right_length;

  for (ssc__core__type__u64 index = 0; index < length; index++) {
    const ssc__core__type__u16 left_unit = left_pointer->ssc__core__member__units[index];
    const ssc__core__type__u16 right_unit = right_pointer->ssc__core__member__units[index];

    if (left_unit != right_unit) {
      return left_unit < right_unit ? -1 : 1;
    }
  }

  if (left_length == right_length) {
    return 0;
  }

  return left_length < right_length ? -1 : 1;
}

inline ssc__core__type__boolean ssc__core__fn__string_units_equals(const ssc__core__struct__string* left_pointer, const ssc__core__struct__string* right_pointer) noexcept {
  if (left_pointer->ssc__core__member__length != right_pointer->ssc__core__member__length) {
    return false;
  }

  return __builtin_memcmp(left_pointer->ssc__core__member__units, right_pointer->ssc__core__member__units, left_pointer->ssc__core__member__length * sizeof(ssc__core__type__u16)) == 0;
}

inline ssc__core__type__ref ssc__core__fn__allocate_string(ssc__core__type__u64 length) {
  void* pointer = malloc(sizeof(ssc__core__struct__string) + length * sizeof(ssc__core__type__u16));

  if (!pointer) [[unlikely]] {
    __builtin_trap();
  }

  ssc__core__struct__string* string_pointer = static_cast<ssc__core__struct__string*>(pointer);
  string_pointer->ssc__core__member__object_header = {1, __builtin_addressof(ssc__core__var__string_descriptor)};
  string_pointer->ssc__core__member__length = length;

  return ssc__core__type__ref(__builtin_addressof(string_pointer->ssc__core__member__object_header));
}

inline ssc__core__type__ref ssc__core__fn__string_from_units(const ssc__core__type__u16* units, ssc__core__type__u64 length) {
  ssc__core__type__ref result = ssc__core__fn__allocate_string(length);

  __builtin_memcpy(reinterpret_cast<ssc__core__struct__string*>(result.ssc__core__member__get_object_header_pointer())->ssc__core__member__units, units, length * sizeof(ssc__core__type__u16));

  return result;
}

export inline ssc__core__type__ref ssc__core__fn__string_concat(const ssc__core__type__ref& left, const ssc__core__type__ref& right) {
  const ssc__core__struct__string* left_pointer = ssc__core__fn__get_string_pointer(left);
  const ssc__core__struct__string* right_pointer = ssc__core__fn__get_string_pointer(right);
  const ssc__core__type__u64 left_length = left_pointer->ssc__core__member__length;
  const ssc__core__type__u64 right_length = right_pointer->ssc__core__member__length;
  ssc__core__type__ref result = ssc__core__fn__allocate_string(left_length + right_length);
  ssc__core__struct__string* result_pointer = reinterpret_cast<ssc__core__struct__string*>(result.ssc__core__member__get_object_header_pointer());

  __builtin_memcpy(result_pointer->ssc__core__member__units, left_pointer->ssc__core__member__units, left_length * sizeof(ssc__core__type__u16));
  __builtin_memcpy(result_pointer->ssc__core__member__units + left_length, right_pointer->ssc__core__member__units, right_length * sizeof(ssc__core__type__u16));

  return result;
}

template <typename Visitor> inline ssc__core__type__boolean ssc__core__fn__visit_utf8(const ssc__core__type__u8* bytes, ssc__core__type__u64 length, Visitor&& visitor) {
  ssc__core__type__u64 index = 0;

  while (index < length) {
    const ssc__core__type__u8 lead = bytes[index];

    if (lead < 0x80) {
      visitor(static_cast<ssc__core__type__u32>(lead));
      index++;
      continue;
    }

    ssc__core__type__u64 size = 0;
    ssc__core__type__u8 second_minimum = 0x80;
    ssc__core__type__u8 second_maximum = 0xBF;

    if (0xC2 <= lead && lead <= 0xDF) {
      size = 2;
    } else if (0xE0 <= lead && lead <= 0xEF) {
      size = 3;
      second_minimum = lead == 0xE0 ? 0xA0 : 0x80;
      second_maximum = lead == 0xED ? 0x9F : 0xBF;
    } else if (0xF0 <= lead && lead <= 0xF4) {
      size = 4;
      second_minimum = lead == 0xF0 ? 0x90 : 0x80;
      second_maximum = lead == 0xF4 ? 0x8F : 0xBF;
    } else {
      return false;
    }

    if (length - index < size || bytes[index + 1] < second_minimum || second_maximum < bytes[index + 1]) {
      return false;
    }

    ssc__core__type__u32 code_point = lead & (0x7F >> size);

    for (ssc__core__type__u64 offset = 1; offset < size; offset++) {
      const ssc__core__type__u8 byte = bytes[index + offset];

      if ((byte & 0xC0) != 0x80) {
        return false;
      }

      code_point = (code_point << 6) | (byte & 0x3F);
    }

    visitor(code_point);
    index += size;
  }

  return true;
}

inline ssc__core__type__boolean ssc__core__fn__is_utf8(const ssc__core__type__u8* bytes, ssc__core__type__u64 length) noexcept {
  return ssc__core__fn__visit_utf8(bytes, length, [](ssc__core__type__u32) {});
}

inline ssc__core__type__boolean ssc__core__fn__utf8_to_utf16(const ssc__core__type__u8* bytes, ssc__core__type__u64 length, std::u16string& units) {
  return ssc__core__fn__visit_utf8(bytes, length, [&](ssc__core__type__u32 code_point) {
    if (code_point < 0x10000) {
      units.push_back(static_cast<char16_t>(code_point));
    } else {
      units.push_back(static_cast<char16_t>(0xD800 + ((code_point - 0x10000) >> 10)));
      units.push_back(static_cast<char16_t>(0xDC00 + ((code_point - 0x10000) & 0x3FF)));
    }
  });
}

inline ssc__core__type__boolean ssc__core__fn__utf16_to_utf8(const ssc__core__type__u16* units, ssc__core__type__u64 length, std::string& bytes, ssc__core__type__boolean is_replacing) {
  for (ssc__core__type__u64 index = 0; index < length; index++) {
    ssc__core__type__u32 code_point = units[index];

    if (0xD800 <= code_point && code_point <= 0xDBFF && index + 1 < length && 0xDC00 <= units[index + 1] && units[index + 1] <= 0xDFFF) {
      code_point = 0x10000 + ((code_point - 0xD800) << 10) + (units[index + 1] - 0xDC00);
      index++;
    } else if (0xD800 <= code_point && code_point <= 0xDFFF) {
      if (!is_replacing) {
        return false;
      }

      code_point = 0xFFFD;
    }

    if (code_point < 0x80) {
      bytes.push_back(static_cast<char>(code_point));
    } else if (code_point < 0x800) {
      bytes.push_back(static_cast<char>(0xC0 | (code_point >> 6)));
      bytes.push_back(static_cast<char>(0x80 | (code_point & 0x3F)));
    } else if (code_point < 0x10000) {
      bytes.push_back(static_cast<char>(0xE0 | (code_point >> 12)));
      bytes.push_back(static_cast<char>(0x80 | ((code_point >> 6) & 0x3F)));
      bytes.push_back(static_cast<char>(0x80 | (code_point & 0x3F)));
    } else {
      bytes.push_back(static_cast<char>(0xF0 | (code_point >> 18)));
      bytes.push_back(static_cast<char>(0x80 | ((code_point >> 12) & 0x3F)));
      bytes.push_back(static_cast<char>(0x80 | ((code_point >> 6) & 0x3F)));
      bytes.push_back(static_cast<char>(0x80 | (code_point & 0x3F)));
    }
  }

  return true;
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_message(const std::string& message) {
  std::u16string units;

  ssc__core__fn__utf8_to_utf16(reinterpret_cast<const ssc__core__type__u8*>(message.data()), message.size(), units);

  throw ssc__core__type__union(ssc__core__fn__string_from_units(reinterpret_cast<const ssc__core__type__u16*>(units.data()), units.size()));
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_lone_surrogate_error() {
  ssc__core__fn__throw_message(std::string("RangeError: A lone surrogate can not be encoded as UTF-8"));
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_utf8_error() {
  ssc__core__fn__throw_message(std::string("RangeError: The bytes are not valid UTF-8"));
}

inline std::string ssc__core__fn__string_to_utf8(const ssc__core__type__ref& string) {
  const ssc__core__struct__string* string_pointer = ssc__core__fn__get_string_pointer(string);
  std::string bytes;

  if (!ssc__core__fn__utf16_to_utf8(string_pointer->ssc__core__member__units, string_pointer->ssc__core__member__length, bytes, false)) [[unlikely]] {
    ssc__core__fn__throw_lone_surrogate_error();
  }

  return bytes;
}

inline ssc__core__type__ref ssc__core__fn__utf8_to_string(const ssc__core__type__u8* bytes, ssc__core__type__u64 length) {
  std::u16string units;

  if (!ssc__core__fn__utf8_to_utf16(bytes, length, units)) [[unlikely]] {
    ssc__core__fn__throw_utf8_error();
  }

  return ssc__core__fn__string_from_units(reinterpret_cast<const ssc__core__type__u16*>(units.data()), units.size());
}

export inline ssc__core__type__ref ssc__core__fn__string_to_bstring(const ssc__core__type__ref& string) {
  const std::string bytes = ssc__core__fn__string_to_utf8(string);

  return ssc__core__fn__bstring_from_bytes(bytes.data(), bytes.size());
}

export inline ssc__core__type__ref ssc__core__fn__bstring_to_string(const ssc__core__type__ref& bstring) {
  const ssc__core__struct__bstring* bstring_pointer = ssc__core__fn__get_bstring_pointer(bstring);

  return ssc__core__fn__utf8_to_string(bstring_pointer->ssc__core__member__bytes, bstring_pointer->ssc__core__member__length);
}

inline ssc__core__type__ref ssc__core__fn__ascii_to_string(const char* bytes, ssc__core__type__u64 length) {
  ssc__core__type__ref result = ssc__core__fn__allocate_string(length);
  ssc__core__struct__string* string_pointer = reinterpret_cast<ssc__core__struct__string*>(result.ssc__core__member__get_object_header_pointer());

  for (ssc__core__type__u64 index = 0; index < length; index++) {
    string_pointer->ssc__core__member__units[index] = static_cast<ssc__core__type__u8>(bytes[index]);
  }

  return result;
}

inline ssc__core__type__boolean ssc__core__fn__is_string(const ssc__core__type__ref& value) noexcept {
  return value.ssc__core__member__get_object_header_pointer()->ssc__core__member__descriptor_pointer == __builtin_addressof(ssc__core__var__string_descriptor);
}

inline ssc__core__type__boolean ssc__core__fn__is_bstring(const ssc__core__type__ref& value) noexcept {
  return value.ssc__core__member__get_object_header_pointer()->ssc__core__member__descriptor_pointer == __builtin_addressof(ssc__core__var__bstring_descriptor);
}

inline void ssc__core__fn__append_text(std::string& buffer, const ssc__core__type__ref& text) {
  if (ssc__core__fn__is_bstring(text)) {
    const ssc__core__struct__bstring* bstring_pointer = ssc__core__fn__get_bstring_pointer(text);

    buffer.append(reinterpret_cast<const char*>(bstring_pointer->ssc__core__member__bytes), bstring_pointer->ssc__core__member__length);
    return;
  }

  const ssc__core__struct__string* string_pointer = ssc__core__fn__get_string_pointer(text);

  ssc__core__fn__utf16_to_utf8(string_pointer->ssc__core__member__units, string_pointer->ssc__core__member__length, buffer, true);
}

inline std::string ssc__core__fn__text_to_utf8(const ssc__core__type__ref& text) {
  std::string buffer;

  ssc__core__fn__append_text(buffer, text);

  return buffer;
}

export inline ssc__core__type__ref ssc__core__fn__to_string(ssc__core__type__undefined) noexcept {
  return ssc__core__fn__string_literal<u"undefined">();
}

export inline ssc__core__type__ref ssc__core__fn__to_string(ssc__core__type__null) noexcept {
  return ssc__core__fn__string_literal<u"null">();
}

export inline ssc__core__type__ref ssc__core__fn__to_string(ssc__core__type__boolean value) noexcept {
  return value ? ssc__core__fn__string_literal<u"true">() : ssc__core__fn__string_literal<u"false">();
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline ssc__core__type__ref ssc__core__fn__to_string(Type value) {
  char buffer[24];
  const std::to_chars_result result = std::to_chars(buffer, buffer + sizeof(buffer), value);

  return ssc__core__fn__ascii_to_string(buffer, result.ptr - buffer);
}

export template <typename Type>
  requires(__is_same(Type, ssc__core__type__f32) || __is_same(Type, ssc__core__type__f64))
inline ssc__core__type__ref ssc__core__fn__to_string(Type value) {
  if (__builtin_isnan(value)) {
    return ssc__core__fn__string_literal<u"NaN">();
  }

  if (__builtin_isinf(value)) {
    return value < 0 ? ssc__core__fn__string_literal<u"-Infinity">() : ssc__core__fn__string_literal<u"Infinity">();
  }

  if (value == 0) {
    return ssc__core__fn__string_literal<u"0">();
  }

  char buffer[32];
  const std::to_chars_result result = std::to_chars(buffer, buffer + sizeof(buffer), value);

  return ssc__core__fn__ascii_to_string(buffer, result.ptr - buffer);
}

export inline ssc__core__type__ref ssc__core__fn__to_string(ssc__core__type__number number) {
  const ssc__core__type__f64 value = static_cast<ssc__core__type__f64>(number);

  if (__builtin_isnan(value)) {
    return ssc__core__fn__string_literal<u"NaN">();
  }

  if (__builtin_isinf(value)) {
    return value < 0 ? ssc__core__fn__string_literal<u"-Infinity">() : ssc__core__fn__string_literal<u"Infinity">();
  }

  if (value == 0) {
    return ssc__core__fn__string_literal<u"0">();
  }

  char scientific[32];
  const std::to_chars_result result = std::to_chars(scientific, scientific + sizeof(scientific), value < 0 ? -value : value, std::chars_format::scientific);
  const std::string_view text(scientific, result.ptr - scientific);
  const ssc__core__type__u64 exponent_index = text.find('e');
  std::string digits(text.substr(0, exponent_index));

  if (digits.size() > 1) {
    digits.erase(1, 1);
  }

  ssc__core__type__i64 exponent = 0;
  std::from_chars(text.data() + exponent_index + (text[exponent_index + 1] == '+' ? 2 : 1), text.data() + text.size(), exponent);

  const ssc__core__type__i64 length = static_cast<ssc__core__type__i64>(digits.size());
  const ssc__core__type__i64 point = exponent + 1;
  std::string buffer = value < 0 ? "-" : "";

  if (length <= point && point <= 21) {
    buffer += digits;
    buffer.append(point - length, '0');
  } else if (0 < point && point <= 21) {
    buffer += digits.substr(0, point);
    buffer += '.';
    buffer += digits.substr(point);
  } else if (-6 < point && point <= 0) {
    buffer += "0.";
    buffer.append(-point, '0');
    buffer += digits;
  } else {
    buffer += digits[0];

    if (length > 1) {
      buffer += '.';
      buffer += digits.substr(1);
    }

    buffer += point - 1 < 0 ? "e-" : "e+";
    buffer += std::to_string(point - 1 < 0 ? 1 - point : point - 1);
  }

  return ssc__core__fn__ascii_to_string(buffer.data(), buffer.size());
}

export inline ssc__core__type__ref ssc__core__fn__to_string(const ssc__core__type__ref& value) {
  if (ssc__core__fn__is_string(value)) {
    return value;
  }

  if (ssc__core__fn__is_bstring(value)) {
    return ssc__core__fn__bstring_to_string(value);
  }

  const ssc__core__struct__descriptor* descriptor_pointer = value.ssc__core__member__get_object_header_pointer()->ssc__core__member__descriptor_pointer;

  if (descriptor_pointer->ssc__core__member__to_string_pointer) {
    return descriptor_pointer->ssc__core__member__to_string_pointer(value);
  }

  return ssc__core__fn__string_literal<u"[object Object]">();
}

export inline ssc__core__type__ref ssc__core__fn__to_string(const ssc__core__type__union& value) {
  const ssc__core__type__u64 type_id = value.ssc__core__member__type_id;
  const auto& member = value.ssc__core__member__value;

  if (type_id == ssc__core__var__type_id<ssc__core__type__undefined>) {
    return ssc__core__fn__to_string(member.ssc__core__member__undefined);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__null>) {
    return ssc__core__fn__to_string(member.ssc__core__member__null);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__boolean>) {
    return ssc__core__fn__to_string(member.ssc__core__member__boolean);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i8>) {
    return ssc__core__fn__to_string(member.ssc__core__member__i8);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i16>) {
    return ssc__core__fn__to_string(member.ssc__core__member__i16);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i32>) {
    return ssc__core__fn__to_string(member.ssc__core__member__i32);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i64>) {
    return ssc__core__fn__to_string(member.ssc__core__member__i64);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u8>) {
    return ssc__core__fn__to_string(member.ssc__core__member__u8);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u16>) {
    return ssc__core__fn__to_string(member.ssc__core__member__u16);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u32>) {
    return ssc__core__fn__to_string(member.ssc__core__member__u32);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u64>) {
    return ssc__core__fn__to_string(member.ssc__core__member__u64);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__f32>) {
    return ssc__core__fn__to_string(member.ssc__core__member__f32);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__f64>) {
    return ssc__core__fn__to_string(member.ssc__core__member__f64);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__number>) {
    return ssc__core__fn__to_string(member.ssc__core__member__number);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__ref>) {
    ssc__core__fn__clone_rc(member.ssc__core__member__object_header_pointer);

    return ssc__core__fn__to_string(ssc__core__type__ref(member.ssc__core__member__object_header_pointer));
  }

  __builtin_trap();
}

export inline ssc__core__type__boolean ssc__core__fn__truthy_f32(ssc__core__type__f32 value) noexcept {
  return !__builtin_isnan(value) && value != 0;
}

export inline ssc__core__type__boolean ssc__core__fn__truthy_f64(ssc__core__type__f64 value) noexcept {
  return !__builtin_isnan(value) && value != 0;
}

export inline ssc__core__type__boolean ssc__core__fn__truthy_number(ssc__core__type__number value) noexcept {
  return ssc__core__fn__truthy_f64(static_cast<ssc__core__type__f64>(value));
}

inline ssc__core__type__boolean ssc__core__fn__truthy_object(const ssc__core__struct__object_header* object_header_pointer) noexcept {
  const ssc__core__struct__descriptor* descriptor_pointer = object_header_pointer->ssc__core__member__descriptor_pointer;

  if (descriptor_pointer == __builtin_addressof(ssc__core__var__string_descriptor)) {
    return reinterpret_cast<const ssc__core__struct__string*>(object_header_pointer)->ssc__core__member__length != 0;
  }

  if (descriptor_pointer == __builtin_addressof(ssc__core__var__bstring_descriptor)) {
    return reinterpret_cast<const ssc__core__struct__bstring*>(object_header_pointer)->ssc__core__member__length != 0;
  }

  return true;
}

export inline ssc__core__type__boolean ssc__core__fn__truthy_ref(const ssc__core__type__ref& value) noexcept {
  return ssc__core__fn__truthy_object(value.ssc__core__member__get_object_header_pointer());
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

  if (type_id == ssc__core__var__type_id<ssc__core__type__f32>) {
    return ssc__core__fn__truthy_f32(member.ssc__core__member__f32);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__f64>) {
    return ssc__core__fn__truthy_f64(member.ssc__core__member__f64);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__number>) {
    return ssc__core__fn__truthy_number(member.ssc__core__member__number);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__ref>) {
    return ssc__core__fn__truthy_object(member.ssc__core__member__object_header_pointer);
  }

  __builtin_trap();
}

export inline ssc__core__type__boolean ssc__core__fn__union_is_undefined(const ssc__core__type__union& value) noexcept {
  return value.ssc__core__member__type_id == ssc__core__var__type_id<ssc__core__type__undefined>;
}

export inline ssc__core__type__boolean ssc__core__fn__union_is_null(const ssc__core__type__union& value) noexcept {
  return value.ssc__core__member__type_id == ssc__core__var__type_id<ssc__core__type__null>;
}

export inline ssc__core__type__boolean ssc__core__fn__union_is_boolean(const ssc__core__type__union& value) noexcept {
  return value.ssc__core__member__type_id == ssc__core__var__type_id<ssc__core__type__boolean>;
}

export inline ssc__core__type__boolean ssc__core__fn__union_is_number(const ssc__core__type__union& value) noexcept {
  const ssc__core__type__u64 type_id = value.ssc__core__member__type_id;
  return (ssc__core__var__type_id<ssc__core__type__i8> <= type_id && type_id <= ssc__core__var__type_id<ssc__core__type__u64>) || (ssc__core__var__type_id<ssc__core__type__f32> <= type_id && type_id <= ssc__core__var__type_id<ssc__core__type__number>);
}

export inline ssc__core__type__boolean ssc__core__fn__union_is_string(const ssc__core__type__union& value) noexcept {
  if (value.ssc__core__member__type_id != ssc__core__var__type_id<ssc__core__type__ref>) {
    return false;
  }
  return value.ssc__core__member__value.ssc__core__member__object_header_pointer->ssc__core__member__descriptor_pointer == __builtin_addressof(ssc__core__var__string_descriptor);
}

export inline ssc__core__type__boolean ssc__core__fn__union_is_bstring(const ssc__core__type__union& value) noexcept {
  if (value.ssc__core__member__type_id != ssc__core__var__type_id<ssc__core__type__ref>) {
    return false;
  }
  return value.ssc__core__member__value.ssc__core__member__object_header_pointer->ssc__core__member__descriptor_pointer == __builtin_addressof(ssc__core__var__bstring_descriptor);
}

export inline ssc__core__type__boolean ssc__core__fn__union_is_function(const ssc__core__type__union& value) noexcept {
  if (value.ssc__core__member__type_id != ssc__core__var__type_id<ssc__core__type__ref>) {
    return false;
  }
  return value.ssc__core__member__value.ssc__core__member__object_header_pointer->ssc__core__member__descriptor_pointer == __builtin_addressof(ssc__core__var__closure_descriptor);
}

export inline ssc__core__type__boolean ssc__core__fn__union_is_object(const ssc__core__type__union& value) noexcept {
  if (ssc__core__fn__union_is_null(value)) {
    return true;
  }
  return value.ssc__core__member__type_id == ssc__core__var__type_id<ssc__core__type__ref> && !ssc__core__fn__union_is_string(value) && !ssc__core__fn__union_is_bstring(value) && !ssc__core__fn__union_is_function(value);
}

template <typename Left, typename Right> inline constexpr ssc__core__type__boolean ssc__core__fn__integer_equals(Left left, Right right) noexcept {
  constexpr ssc__core__type__boolean is_left_signed = static_cast<Left>(-1) < 0;
  constexpr ssc__core__type__boolean is_right_signed = static_cast<Right>(-1) < 0;

  if constexpr (is_left_signed && is_right_signed) {
    return static_cast<ssc__core__type__i64>(left) == static_cast<ssc__core__type__i64>(right);
  } else if constexpr (is_left_signed) {
    return 0 <= left && static_cast<ssc__core__type__u64>(left) == static_cast<ssc__core__type__u64>(right);
  } else if constexpr (is_right_signed) {
    return 0 <= right && static_cast<ssc__core__type__u64>(left) == static_cast<ssc__core__type__u64>(right);
  } else {
    return static_cast<ssc__core__type__u64>(left) == static_cast<ssc__core__type__u64>(right);
  }
}

template <typename Left, typename Right> inline constexpr ssc__core__type__boolean ssc__core__fn__number_equals(Left left, Right right) noexcept {
  constexpr ssc__core__type__boolean is_left_float = 32 <= ssc__core__var__type_id<Left>;
  constexpr ssc__core__type__boolean is_right_float = 32 <= ssc__core__var__type_id<Right>;

  if constexpr (is_left_float && is_right_float) {
    return static_cast<ssc__core__type__f64>(left) == static_cast<ssc__core__type__f64>(right);
  } else if constexpr (is_left_float) {
    return ssc__core__fn__number_equals(right, left);
  } else if constexpr (is_right_float) {
    const ssc__core__type__f64 value = static_cast<ssc__core__type__f64>(right);

    if (value != __builtin_trunc(value)) {
      return false;
    }

    if (value < 0) {
      return -9223372036854775808.0 <= value && ssc__core__fn__integer_equals(left, static_cast<ssc__core__type__i64>(value));
    }

    return value < 18446744073709551616.0 && ssc__core__fn__integer_equals(left, static_cast<ssc__core__type__u64>(value));
  } else {
    return ssc__core__fn__integer_equals(left, right);
  }
}

export template <typename Type>
  requires((17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24) || (32 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 34))
inline ssc__core__type__boolean ssc__core__fn__strict_equals(const ssc__core__type__union& left, Type right) noexcept {
  const ssc__core__type__u64 type_id = left.ssc__core__member__type_id;
  const auto& member = left.ssc__core__member__value;

  if (type_id == ssc__core__var__type_id<ssc__core__type__i8>) {
    return ssc__core__fn__number_equals(member.ssc__core__member__i8, right);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i16>) {
    return ssc__core__fn__number_equals(member.ssc__core__member__i16, right);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i32>) {
    return ssc__core__fn__number_equals(member.ssc__core__member__i32, right);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i64>) {
    return ssc__core__fn__number_equals(member.ssc__core__member__i64, right);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u8>) {
    return ssc__core__fn__number_equals(member.ssc__core__member__u8, right);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u16>) {
    return ssc__core__fn__number_equals(member.ssc__core__member__u16, right);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u32>) {
    return ssc__core__fn__number_equals(member.ssc__core__member__u32, right);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u64>) {
    return ssc__core__fn__number_equals(member.ssc__core__member__u64, right);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__f32>) {
    return ssc__core__fn__number_equals(member.ssc__core__member__f32, right);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__f64>) {
    return ssc__core__fn__number_equals(member.ssc__core__member__f64, right);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__number>) {
    return ssc__core__fn__number_equals(member.ssc__core__member__number, right);
  }

  return false;
}

export template <typename Type>
  requires((17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24) || (32 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 34))
inline ssc__core__type__boolean ssc__core__fn__strict_equals(Type left, const ssc__core__type__union& right) noexcept {
  return ssc__core__fn__strict_equals(right, left);
}

export inline ssc__core__type__boolean ssc__core__fn__strict_equals(const ssc__core__type__union& left, ssc__core__type__boolean right) noexcept {
  return ssc__core__fn__union_is_boolean(left) && left.ssc__core__member__value.ssc__core__member__boolean == right;
}

export inline ssc__core__type__boolean ssc__core__fn__strict_equals(ssc__core__type__boolean left, const ssc__core__type__union& right) noexcept {
  return ssc__core__fn__strict_equals(right, left);
}

inline ssc__core__type__boolean ssc__core__fn__object_equals(const ssc__core__struct__object_header* left_pointer, const ssc__core__struct__object_header* right_pointer) noexcept {
  if (left_pointer == right_pointer) {
    return true;
  }

  const ssc__core__struct__descriptor* descriptor_pointer = left_pointer->ssc__core__member__descriptor_pointer;

  if (descriptor_pointer != right_pointer->ssc__core__member__descriptor_pointer) {
    return false;
  }

  if (descriptor_pointer == __builtin_addressof(ssc__core__var__bstring_descriptor)) {
    return ssc__core__fn__bstring_bytes_equals(reinterpret_cast<const ssc__core__struct__bstring*>(left_pointer), reinterpret_cast<const ssc__core__struct__bstring*>(right_pointer));
  }

  if (descriptor_pointer == __builtin_addressof(ssc__core__var__string_descriptor)) {
    return ssc__core__fn__string_units_equals(reinterpret_cast<const ssc__core__struct__string*>(left_pointer), reinterpret_cast<const ssc__core__struct__string*>(right_pointer));
  }

  return false;
}

export inline ssc__core__type__boolean ssc__core__fn__strict_equals(const ssc__core__type__union& left, const ssc__core__type__ref& right) noexcept {
  if (left.ssc__core__member__type_id != ssc__core__var__type_id<ssc__core__type__ref>) {
    return false;
  }

  return ssc__core__fn__object_equals(left.ssc__core__member__value.ssc__core__member__object_header_pointer, right.ssc__core__member__get_object_header_pointer());
}

export inline ssc__core__type__boolean ssc__core__fn__strict_equals(const ssc__core__type__ref& left, const ssc__core__type__ref& right) noexcept {
  return ssc__core__fn__object_equals(left.ssc__core__member__get_object_header_pointer(), right.ssc__core__member__get_object_header_pointer());
}

export inline ssc__core__type__boolean ssc__core__fn__strict_equals(const ssc__core__type__ref& left, const ssc__core__type__union& right) noexcept {
  return ssc__core__fn__strict_equals(right, left);
}

export inline ssc__core__type__boolean ssc__core__fn__strict_equals(const ssc__core__type__union& left, const ssc__core__type__union& right) noexcept {
  const ssc__core__type__u64 type_id = left.ssc__core__member__type_id;
  const auto& member = left.ssc__core__member__value;

  if (type_id == ssc__core__var__type_id<ssc__core__type__i8>) {
    return ssc__core__fn__strict_equals(right, member.ssc__core__member__i8);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i16>) {
    return ssc__core__fn__strict_equals(right, member.ssc__core__member__i16);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i32>) {
    return ssc__core__fn__strict_equals(right, member.ssc__core__member__i32);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i64>) {
    return ssc__core__fn__strict_equals(right, member.ssc__core__member__i64);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u8>) {
    return ssc__core__fn__strict_equals(right, member.ssc__core__member__u8);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u16>) {
    return ssc__core__fn__strict_equals(right, member.ssc__core__member__u16);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u32>) {
    return ssc__core__fn__strict_equals(right, member.ssc__core__member__u32);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u64>) {
    return ssc__core__fn__strict_equals(right, member.ssc__core__member__u64);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__f32>) {
    return ssc__core__fn__strict_equals(right, member.ssc__core__member__f32);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__f64>) {
    return ssc__core__fn__strict_equals(right, member.ssc__core__member__f64);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__number>) {
    return ssc__core__fn__strict_equals(right, member.ssc__core__member__number);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__boolean>) {
    return ssc__core__fn__strict_equals(right, member.ssc__core__member__boolean);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__ref>) {
    return right.ssc__core__member__type_id == type_id && ssc__core__fn__object_equals(member.ssc__core__member__object_header_pointer, right.ssc__core__member__value.ssc__core__member__object_header_pointer);
  }

  return right.ssc__core__member__type_id == type_id;
}

export inline ssc__core__type__boolean ssc__core__fn__strict_equals(const ssc__core__type__union& left, ssc__core__type__undefined) noexcept {
  return ssc__core__fn__union_is_undefined(left);
}

export inline ssc__core__type__boolean ssc__core__fn__strict_equals(ssc__core__type__undefined, const ssc__core__type__union& right) noexcept {
  return ssc__core__fn__union_is_undefined(right);
}

export inline ssc__core__type__boolean ssc__core__fn__strict_equals(const ssc__core__type__union& left, ssc__core__type__null) noexcept {
  return ssc__core__fn__union_is_null(left);
}

export inline ssc__core__type__boolean ssc__core__fn__strict_equals(ssc__core__type__null, const ssc__core__type__union& right) noexcept {
  return ssc__core__fn__union_is_null(right);
}

export template <typename Left, typename Right>
  requires(ssc__core__var__type_id<Left> != 0 && ssc__core__var__type_id<Right> != 0 && (__is_same(Left, ssc__core__type__undefined) || __is_same(Left, ssc__core__type__null) || __is_same(Right, ssc__core__type__undefined) || __is_same(Right, ssc__core__type__null)))
inline constexpr ssc__core__type__boolean ssc__core__fn__strict_equals(const Left&, const Right&) noexcept {
  return ssc__core__var__type_id<Left> == ssc__core__var__type_id<Right>;
}

export inline ssc__core__type__ref ssc__core__fn__typeof(const ssc__core__type__union& value) noexcept {
  if (ssc__core__fn__union_is_undefined(value)) {
    return ssc__core__fn__string_literal<u"undefined">();
  }

  if (ssc__core__fn__union_is_boolean(value)) {
    return ssc__core__fn__string_literal<u"boolean">();
  }

  if (ssc__core__fn__union_is_number(value)) {
    return ssc__core__fn__string_literal<u"number">();
  }

  if (ssc__core__fn__union_is_string(value) || ssc__core__fn__union_is_bstring(value)) {
    return ssc__core__fn__string_literal<u"string">();
  }

  if (ssc__core__fn__union_is_function(value)) {
    return ssc__core__fn__string_literal<u"function">();
  }

  return ssc__core__fn__string_literal<u"object">();
}

inline std::string ssc__core__fn__get_display_type_name(ssc__core__type__u64 type_id) {
  if (type_id == ssc__core__var__type_id<ssc__core__type__undefined>) {
    return "undefined";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__null>) {
    return "null";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__boolean>) {
    return "boolean";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__i8>) {
    return "i8";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__i16>) {
    return "i16";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__i32>) {
    return "i32";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__i64>) {
    return "i64";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__u8>) {
    return "u8";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__u16>) {
    return "u16";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__u32>) {
    return "u32";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__u64>) {
    return "u64";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__f32>) {
    return "f32";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__f64>) {
    return "f64";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__number>) {
    return "number";
  }
  if (type_id == ssc__core__var__type_id<ssc__core__type__ref>) {
    return "object";
  }
  return "#" + std::to_string(type_id);
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_union_type_error(const ssc__core__type__union& value, const char* type_name_pointer) {
  const std::string display_type_name = ssc__core__fn__union_is_string(value) || ssc__core__fn__union_is_bstring(value) ? "string" : ssc__core__fn__get_display_type_name(value.ssc__core__member__type_id);
  ssc__core__fn__throw_message(std::string("TypeError: Type '") + display_type_name + "' is not assignable to type '" + type_name_pointer + "'");
}

export inline ssc__core__type__undefined ssc__core__fn__union_to_undefined(const ssc__core__type__union& value) {
  if (value.ssc__core__member__type_id != ssc__core__var__type_id<ssc__core__type__undefined>) [[unlikely]] {
    ssc__core__fn__throw_union_type_error(value, "undefined");
  }
  return ssc__core__var__undefined;
}

export inline ssc__core__type__null ssc__core__fn__union_to_null(const ssc__core__type__union& value) {
  if (value.ssc__core__member__type_id != ssc__core__var__type_id<ssc__core__type__null>) [[unlikely]] {
    ssc__core__fn__throw_union_type_error(value, "null");
  }
  return ssc__core__var__null;
}

export inline ssc__core__type__boolean ssc__core__fn__union_to_boolean(const ssc__core__type__union& value) {
  if (value.ssc__core__member__type_id != ssc__core__var__type_id<ssc__core__type__boolean>) [[unlikely]] {
    ssc__core__fn__throw_union_type_error(value, "boolean");
  }
  return value.ssc__core__member__value.ssc__core__member__boolean;
}

export inline ssc__core__type__ref ssc__core__fn__union_to_ref(const ssc__core__type__union& value) {
  if (value.ssc__core__member__type_id != ssc__core__var__type_id<ssc__core__type__ref>) [[unlikely]] {
    ssc__core__fn__throw_union_type_error(value, "object");
  }
  ssc__core__struct__object_header* object_header_pointer = value.ssc__core__member__value.ssc__core__member__object_header_pointer;
  ssc__core__fn__clone_rc(object_header_pointer);
  return ssc__core__type__ref(object_header_pointer);
}

export template <typename Type>
  requires((17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24) || (32 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 34))
inline Type ssc__core__fn__union_to_number(const ssc__core__type__union& value) {
  const ssc__core__type__u64 type_id = value.ssc__core__member__type_id;
  const auto& member = value.ssc__core__member__value;

  if (type_id == ssc__core__var__type_id<ssc__core__type__i8>) {
    return static_cast<Type>(member.ssc__core__member__i8);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i16>) {
    return static_cast<Type>(member.ssc__core__member__i16);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i32>) {
    return static_cast<Type>(member.ssc__core__member__i32);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__i64>) {
    return static_cast<Type>(member.ssc__core__member__i64);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u8>) {
    return static_cast<Type>(member.ssc__core__member__u8);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u16>) {
    return static_cast<Type>(member.ssc__core__member__u16);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u32>) {
    return static_cast<Type>(member.ssc__core__member__u32);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__u64>) {
    return static_cast<Type>(member.ssc__core__member__u64);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__f32>) {
    return static_cast<Type>(member.ssc__core__member__f32);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__f64>) {
    return static_cast<Type>(member.ssc__core__member__f64);
  }

  if (type_id == ssc__core__var__type_id<ssc__core__type__number>) {
    return static_cast<Type>(static_cast<ssc__core__type__f64>(member.ssc__core__member__number));
  }

  ssc__core__fn__throw_union_type_error(value, "number");
}

template <typename Type> inline ssc__core__type__boolean ssc__core__fn__union_is(const ssc__core__type__union& value) noexcept {
  return value.ssc__core__member__type_id == ssc__core__var__type_id<Type>;
}

export template <typename Type>
  requires(ssc__core__var__type_id<Type> != 0)
inline Type ssc__core__fn__union_as(const ssc__core__type__union& value, const char* type_name_pointer) {
  if (!ssc__core__fn__union_is<Type>(value)) [[unlikely]] {
    ssc__core__fn__throw_union_type_error(value, type_name_pointer);
  }

  if constexpr (__is_same(Type, ssc__core__type__ref)) {
    ssc__core__fn__clone_rc(value.ssc__core__member__value.ssc__core__member__object_header_pointer);

    return ssc__core__type__ref(value.ssc__core__member__value.ssc__core__member__object_header_pointer);
  } else {
    Type result;

    __builtin_memcpy(__builtin_addressof(result), __builtin_addressof(value.ssc__core__member__value), sizeof(Type));

    return result;
  }
}

export template <typename... Types>
  requires((ssc__core__var__type_id<Types> != 0) && ...)
inline ssc__core__type__union ssc__core__fn__union_as_union(const ssc__core__type__union& value, const char* type_name_pointer) {
  if (!(ssc__core__fn__union_is<Types>(value) || ...)) [[unlikely]] {
    ssc__core__fn__throw_union_type_error(value, type_name_pointer);
  }

  return value;
}

template <typename Type> inline ssc__core__type__ref ssc__core__fn__inspect(const Type& value) {
  return ssc__core__fn__to_string(value);
}

inline ssc__core__type__ref ssc__core__fn__inspect(const ssc__core__type__ref& value) {
  if (ssc__core__fn__is_string(value) || ssc__core__fn__is_bstring(value)) {
    std::string buffer = "'";

    ssc__core__fn__append_text(buffer, value);
    buffer.push_back('\'');

    return ssc__core__fn__utf8_to_string(reinterpret_cast<const ssc__core__type__u8*>(buffer.data()), buffer.size());
  }

  const ssc__core__struct__descriptor* descriptor_pointer = value.ssc__core__member__get_object_header_pointer()->ssc__core__member__descriptor_pointer;

  if (descriptor_pointer->ssc__core__member__inspect_pointer) {
    return descriptor_pointer->ssc__core__member__inspect_pointer(value);
  }

  return ssc__core__fn__to_string(value);
}

inline ssc__core__type__ref ssc__core__fn__inspect(const ssc__core__type__union& value) {
  if (value.ssc__core__member__type_id == ssc__core__var__type_id<ssc__core__type__ref>) {
    return ssc__core__fn__inspect(ssc__core__fn__union_to_ref(value));
  }

  return ssc__core__fn__to_string(value);
}

template <typename Type> inline ssc__core__type__ref ssc__core__fn__console_string(const Type& value) {
  return ssc__core__fn__inspect(value);
}

inline ssc__core__type__ref ssc__core__fn__console_string(const ssc__core__type__ref& value) {
  return ssc__core__fn__is_string(value) || ssc__core__fn__is_bstring(value) ? value : ssc__core__fn__inspect(value);
}

inline ssc__core__type__ref ssc__core__fn__console_string(const ssc__core__type__union& value) {
  return ssc__core__fn__union_is_string(value) || ssc__core__fn__union_is_bstring(value) ? ssc__core__fn__union_to_ref(value) : ssc__core__fn__inspect(value);
}

export inline constexpr ssc__core__type__u64 ssc__core__var__union_kind = 4;

export inline ssc__core__type__ref ssc__core__fn__allocate_object(ssc__core__type__u64 size, const ssc__core__struct__descriptor* descriptor_pointer) {
  void* pointer = malloc(size);

  if (!pointer) [[unlikely]] {
    __builtin_trap();
  }

  char* bytes = static_cast<char*>(pointer);
  const ssc__core__struct__shape* shape_pointer = descriptor_pointer->ssc__core__member__shape_pointer;

  *static_cast<ssc__core__struct__object_header*>(pointer) = {1, descriptor_pointer};
  __builtin_memset(bytes + sizeof(ssc__core__struct__object_header), 0, size - sizeof(ssc__core__struct__object_header));

  for (const ssc__core__type__u64 offset : shape_pointer->ssc__core__member__ref_offsets) {
    std::construct_at(reinterpret_cast<ssc__core__type__ref*>(bytes + offset));
  }

  for (const ssc__core__type__u64 offset : shape_pointer->ssc__core__member__union_offsets) {
    std::construct_at(reinterpret_cast<ssc__core__type__union*>(bytes + offset), ssc__core__var__undefined);
  }

  return ssc__core__type__ref(static_cast<ssc__core__struct__object_header*>(pointer));
}

inline ssc__core__type__u64 ssc__core__fn__field_offset(const ssc__core__struct__object_header* object_header_pointer, ssc__core__type__u64 shape_id, ssc__core__type__u64 offset, const char* name) noexcept {
  const ssc__core__struct__shape* shape_pointer = object_header_pointer->ssc__core__member__descriptor_pointer->ssc__core__member__shape_pointer;

  if (shape_pointer->ssc__core__member__id == shape_id) [[likely]] {
    return offset;
  }

  for (const ssc__core__struct__property& property : shape_pointer->ssc__core__member__properties) {
    if (__builtin_strcmp(property.ssc__core__member__name, name) == 0) {
      return property.ssc__core__member__offset;
    }
  }

  __builtin_trap();
}

export template <typename Type> inline Type& ssc__core__fn__field(const ssc__core__type__ref& object, ssc__core__type__u64 shape_id, ssc__core__type__u64 offset, const char* name) noexcept {
  ssc__core__struct__object_header* object_header_pointer = object.ssc__core__member__get_object_header_pointer();

  return *reinterpret_cast<Type*>(reinterpret_cast<char*>(object_header_pointer) + ssc__core__fn__field_offset(object_header_pointer, shape_id, offset, name));
}

template <typename Type> inline ssc__core__type__ref ssc__core__fn__inspect_at(const char* pointer) {
  return ssc__core__fn__inspect(*reinterpret_cast<const Type*>(pointer));
}

inline ssc__core__type__ref ssc__core__fn__inspect_field(const char* pointer, ssc__core__type__u64 kind) {
  if (kind == ssc__core__var__union_kind) {
    return ssc__core__fn__inspect_at<ssc__core__type__union>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__undefined>) {
    return ssc__core__fn__inspect_at<ssc__core__type__undefined>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__null>) {
    return ssc__core__fn__inspect_at<ssc__core__type__null>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__boolean>) {
    return ssc__core__fn__inspect_at<ssc__core__type__boolean>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__i8>) {
    return ssc__core__fn__inspect_at<ssc__core__type__i8>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__i16>) {
    return ssc__core__fn__inspect_at<ssc__core__type__i16>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__i32>) {
    return ssc__core__fn__inspect_at<ssc__core__type__i32>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__i64>) {
    return ssc__core__fn__inspect_at<ssc__core__type__i64>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__u8>) {
    return ssc__core__fn__inspect_at<ssc__core__type__u8>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__u16>) {
    return ssc__core__fn__inspect_at<ssc__core__type__u16>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__u32>) {
    return ssc__core__fn__inspect_at<ssc__core__type__u32>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__u64>) {
    return ssc__core__fn__inspect_at<ssc__core__type__u64>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__f32>) {
    return ssc__core__fn__inspect_at<ssc__core__type__f32>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__f64>) {
    return ssc__core__fn__inspect_at<ssc__core__type__f64>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__number>) {
    return ssc__core__fn__inspect_at<ssc__core__type__number>(pointer);
  }

  if (kind == ssc__core__var__type_id<ssc__core__type__ref>) {
    return ssc__core__fn__inspect_at<ssc__core__type__ref>(pointer);
  }

  __builtin_trap();
}

export inline ssc__core__type__ref ssc__core__fn__object_inspect(const ssc__core__type__ref& object) {
  const ssc__core__struct__object_header* object_header_pointer = object.ssc__core__member__get_object_header_pointer();
  const ssc__core__struct__descriptor* descriptor_pointer = object_header_pointer->ssc__core__member__descriptor_pointer;
  const ssc__core__struct__span<ssc__core__struct__property> properties = descriptor_pointer->ssc__core__member__shape_pointer->ssc__core__member__properties;

  const char* class_name = descriptor_pointer->ssc__core__member__class_name;
  std::string buffer = class_name ? std::string(class_name) + " " : std::string();

  if (descriptor_pointer->ssc__core__member__keys.ssc__core__member__length == 0) {
    buffer.append("{}");

    return ssc__core__fn__utf8_to_string(reinterpret_cast<const ssc__core__type__u8*>(buffer.data()), buffer.size());
  }

  buffer.append("{ ");
  ssc__core__type__boolean is_first = true;

  for (const ssc__core__type__u64 key : descriptor_pointer->ssc__core__member__keys) {
    const ssc__core__struct__property& property = properties[key];

    if (!is_first) {
      buffer.append(", ");
    }

    is_first = false;
    buffer.append(property.ssc__core__member__name);
    buffer.append(": ");
    ssc__core__fn__append_text(buffer, ssc__core__fn__inspect_field(reinterpret_cast<const char*>(object_header_pointer) + property.ssc__core__member__offset, property.ssc__core__member__kind));
  }

  buffer.append(" }");

  return ssc__core__fn__utf8_to_string(reinterpret_cast<const ssc__core__type__u8*>(buffer.data()), buffer.size());
}

export template <typename Element> struct ssc__core__struct__array {
  ssc__core__struct__object_header ssc__core__member__object_header;
  ssc__core__type__u64 ssc__core__member__length;
  ssc__core__type__u64 ssc__core__member__capacity;
  Element* ssc__core__member__elements_pointer;
};

static_assert(sizeof(ssc__core__struct__array<ssc__core__type__u8>) == 40);

export inline constexpr ssc__core__struct__shape ssc__core__var__array_shape{};

template <typename Element> inline ssc__core__struct__array<Element>* ssc__core__fn__get_array_pointer(const ssc__core__type__ref& array) noexcept {
  return reinterpret_cast<ssc__core__struct__array<Element>*>(array.ssc__core__member__get_object_header_pointer());
}

template <typename Element> inline void ssc__core__fn__array_destroy(ssc__core__struct__object_header* object_header_pointer) noexcept {
  ssc__core__struct__array<Element>* array_pointer = reinterpret_cast<ssc__core__struct__array<Element>*>(object_header_pointer);

  for (ssc__core__type__u64 index = 0; index < array_pointer->ssc__core__member__length; index++) {
    std::destroy_at(array_pointer->ssc__core__member__elements_pointer + index);
  }

  free(array_pointer->ssc__core__member__elements_pointer);
}

template <typename Element> inline ssc__core__type__ref ssc__core__fn__array_to_string(const ssc__core__type__ref& array) {
  const ssc__core__struct__array<Element>* array_pointer = ssc__core__fn__get_array_pointer<Element>(array);
  std::string buffer;

  for (ssc__core__type__u64 index = 0; index < array_pointer->ssc__core__member__length; index++) {
    const Element& element = array_pointer->ssc__core__member__elements_pointer[index];

    if (index != 0) {
      buffer.push_back(',');
    }

    if constexpr (__is_same(Element, ssc__core__type__union)) {
      if (ssc__core__fn__union_is_undefined(element) || ssc__core__fn__union_is_null(element)) {
        continue;
      }
    }

    ssc__core__fn__append_text(buffer, ssc__core__fn__to_string(element));
  }

  return ssc__core__fn__utf8_to_string(reinterpret_cast<const ssc__core__type__u8*>(buffer.data()), buffer.size());
}

template <typename Element> inline ssc__core__type__ref ssc__core__fn__array_inspect(const ssc__core__type__ref& array) {
  const ssc__core__struct__array<Element>* array_pointer = ssc__core__fn__get_array_pointer<Element>(array);

  if (array_pointer->ssc__core__member__length == 0) {
    return ssc__core__fn__string_literal<u"[]">();
  }

  std::string buffer = "[ ";

  for (ssc__core__type__u64 index = 0; index < array_pointer->ssc__core__member__length; index++) {
    if (index != 0) {
      buffer.append(", ");
    }

    ssc__core__fn__append_text(buffer, ssc__core__fn__inspect(array_pointer->ssc__core__member__elements_pointer[index]));
  }

  buffer.append(" ]");

  return ssc__core__fn__utf8_to_string(reinterpret_cast<const ssc__core__type__u8*>(buffer.data()), buffer.size());
}

// TODO: replace std::addressof with __builtin_addressof once https://github.com/llvm/llvm-project/pull/235313 is released
template <typename Element> inline constexpr ssc__core__struct__descriptor ssc__core__var__array_descriptor{__builtin_addressof(ssc__core__var__array_shape), std::addressof(ssc__core__fn__array_destroy<Element>), std::addressof(ssc__core__fn__array_to_string<Element>), std::addressof(ssc__core__fn__array_inspect<Element>)};

template <typename Element> inline void ssc__core__fn__array_reserve(ssc__core__struct__array<Element>* array_pointer, ssc__core__type__u64 capacity) {
  if (capacity <= array_pointer->ssc__core__member__capacity) {
    return;
  }

  const ssc__core__type__u64 next_capacity = array_pointer->ssc__core__member__capacity * 2 < capacity ? capacity : array_pointer->ssc__core__member__capacity * 2;
  void* pointer = realloc(array_pointer->ssc__core__member__elements_pointer, next_capacity * sizeof(Element));

  if (!pointer) [[unlikely]] {
    __builtin_trap();
  }

  array_pointer->ssc__core__member__elements_pointer = static_cast<Element*>(pointer);
  array_pointer->ssc__core__member__capacity = next_capacity;
}

export template <typename Element, typename... Values> inline ssc__core__type__ref ssc__core__fn__array_of(Values&&... values) {
  void* pointer = malloc(sizeof(ssc__core__struct__array<Element>));

  if (!pointer) [[unlikely]] {
    __builtin_trap();
  }

  ssc__core__struct__array<Element>* array_pointer = static_cast<ssc__core__struct__array<Element>*>(pointer);
  array_pointer->ssc__core__member__object_header = {1, __builtin_addressof(ssc__core__var__array_descriptor<Element>)};
  array_pointer->ssc__core__member__length = 0;
  array_pointer->ssc__core__member__capacity = 0;
  array_pointer->ssc__core__member__elements_pointer = nullptr;

  ssc__core__type__ref result(__builtin_addressof(array_pointer->ssc__core__member__object_header));

  ssc__core__fn__array_reserve(array_pointer, sizeof...(Values));
  (std::construct_at(array_pointer->ssc__core__member__elements_pointer + array_pointer->ssc__core__member__length++, static_cast<Values&&>(values)), ...);

  return result;
}

export inline ssc__core__type__u64 ssc__core__fn__array_length(const ssc__core__type__ref& array) noexcept {
  return ssc__core__fn__get_array_pointer<ssc__core__type__u8>(array)->ssc__core__member__length;
}

inline ssc__core__type__ref ssc__core__fn__u8_array_from_bytes(const ssc__core__type__u8* bytes, ssc__core__type__u64 length) {
  ssc__core__type__ref result = ssc__core__fn__array_of<ssc__core__type__u8>();
  ssc__core__struct__array<ssc__core__type__u8>* array_pointer = ssc__core__fn__get_array_pointer<ssc__core__type__u8>(result);

  ssc__core__fn__array_reserve(array_pointer, length);
  __builtin_memcpy(array_pointer->ssc__core__member__elements_pointer, bytes, length);
  array_pointer->ssc__core__member__length = length;

  return result;
}

export inline ssc__core__type__ref ssc__core__fn__bstring_to_u8_array(const ssc__core__type__ref& bstring) {
  const ssc__core__struct__bstring* bstring_pointer = ssc__core__fn__get_bstring_pointer(bstring);

  return ssc__core__fn__u8_array_from_bytes(bstring_pointer->ssc__core__member__bytes, bstring_pointer->ssc__core__member__length);
}

export inline ssc__core__type__ref ssc__core__fn__string_to_u8_array(const ssc__core__type__ref& string) {
  const std::string bytes = ssc__core__fn__string_to_utf8(string);

  return ssc__core__fn__u8_array_from_bytes(reinterpret_cast<const ssc__core__type__u8*>(bytes.data()), bytes.size());
}

export inline ssc__core__type__ref ssc__core__fn__u8_array_to_bstring(const ssc__core__type__ref& array) {
  const ssc__core__struct__array<ssc__core__type__u8>* array_pointer = ssc__core__fn__get_array_pointer<ssc__core__type__u8>(array);
  const ssc__core__type__u8* bytes = array_pointer->ssc__core__member__elements_pointer;
  const ssc__core__type__u64 length = array_pointer->ssc__core__member__length;

  if (!ssc__core__fn__is_utf8(bytes, length)) [[unlikely]] {
    ssc__core__fn__throw_utf8_error();
  }

  return ssc__core__fn__bstring_from_bytes(reinterpret_cast<const char*>(bytes), length);
}

export inline ssc__core__type__ref ssc__core__fn__u8_array_to_string(const ssc__core__type__ref& array) {
  const ssc__core__struct__array<ssc__core__type__u8>* array_pointer = ssc__core__fn__get_array_pointer<ssc__core__type__u8>(array);

  return ssc__core__fn__utf8_to_string(array_pointer->ssc__core__member__elements_pointer, array_pointer->ssc__core__member__length);
}

export inline ssc__core__type__ref ssc__core__fn__u16_array_to_string(const ssc__core__type__ref& array) {
  const ssc__core__struct__array<ssc__core__type__u16>* array_pointer = ssc__core__fn__get_array_pointer<ssc__core__type__u16>(array);

  return ssc__core__fn__string_from_units(array_pointer->ssc__core__member__elements_pointer, array_pointer->ssc__core__member__length);
}

inline ssc__core__type__u64 ssc__core__fn__to_array_position(ssc__core__type__u64 index) noexcept {
  return index;
}

inline ssc__core__type__u64 ssc__core__fn__to_array_position(ssc__core__type__number number) noexcept {
  const ssc__core__type__f64 index = static_cast<ssc__core__type__f64>(number);

  if (index < 0 || 18446744073709551616.0 <= index || __builtin_trunc(index) != index) {
    return static_cast<ssc__core__type__u64>(-1);
  }

  return static_cast<ssc__core__type__u64>(index);
}

export template <typename Element, typename Index>
  requires(ssc__core__var__type_id<Index> == 24 || ssc__core__var__type_id<Index> == 34)
inline ssc__core__type__union ssc__core__fn__array_get(const ssc__core__type__ref& array, Index index) {
  const ssc__core__struct__array<Element>* array_pointer = ssc__core__fn__get_array_pointer<Element>(array);
  const ssc__core__type__u64 position = ssc__core__fn__to_array_position(index);

  if (position >= array_pointer->ssc__core__member__length) {
    return ssc__core__type__union(ssc__core__var__undefined);
  }

  const Element& element = array_pointer->ssc__core__member__elements_pointer[position];

  if constexpr (__is_same(Element, ssc__core__type__union)) {
    return element;
  } else {
    return ssc__core__type__union(Element(element));
  }
}

template <typename Type>
  requires((17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24) || (32 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 34))
inline std::string ssc__core__fn__number_text(Type value) {
  return ssc__core__fn__text_to_utf8(ssc__core__fn__to_string(value));
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_number_conversion_error(const std::string& text, const char* type_name_pointer) {
  ssc__core__fn__throw_message("RangeError: " + text + " can not be converted to " + type_name_pointer);
}

template <typename Target, typename Source>
  requires(((17 <= ssc__core__var__type_id<Target> && ssc__core__var__type_id<Target> <= 24) || (32 <= ssc__core__var__type_id<Target> && ssc__core__var__type_id<Target> <= 34)) && ((17 <= ssc__core__var__type_id<Source> && ssc__core__var__type_id<Source> <= 24) || (32 <= ssc__core__var__type_id<Source> && ssc__core__var__type_id<Source> <= 34)))
inline constexpr ssc__core__type__boolean ssc__core__fn__is_exact_number(Source value) noexcept {
  if constexpr (ssc__core__var__type_id<Source> == ssc__core__var__type_id<ssc__core__type__number>) {
    return ssc__core__fn__is_exact_number<Target>(static_cast<ssc__core__type__f64>(value));
  } else if constexpr (ssc__core__var__type_id<Target> == ssc__core__var__type_id<ssc__core__type__number>) {
    return ssc__core__fn__is_exact_number<ssc__core__type__f64>(value);
  } else if constexpr (ssc__core__var__type_id<Target> <= 24 && ssc__core__var__type_id<Source> <= 24) {
    return std::in_range<Target>(value);
  } else if constexpr (ssc__core__var__type_id<Target> <= 24) {
    const Source minimum = static_cast<Source>(std::numeric_limits<Target>::min());
    const Source end = static_cast<Source>(std::numeric_limits<Target>::max() / 2 + 1) * 2;

    return __builtin_trunc(value) == value && minimum <= value && value < end;
  } else if constexpr (ssc__core__var__type_id<Source> <= 24) {
    const Target converted = static_cast<Target>(value);
    const Target end = static_cast<Target>(std::numeric_limits<Source>::max() / 2 + 1) * 2;

    return converted < end && static_cast<Source>(converted) == value;
  } else {
    if (__builtin_isnan(value) || __builtin_isinf(value)) {
      return true;
    }

    const Source maximum = std::numeric_limits<Target>::max();

    return -maximum <= value && value <= maximum && static_cast<Source>(static_cast<Target>(value)) == value;
  }
}

export template <typename Target, typename Source>
  requires(((17 <= ssc__core__var__type_id<Target> && ssc__core__var__type_id<Target> <= 24) || (32 <= ssc__core__var__type_id<Target> && ssc__core__var__type_id<Target> <= 34)) && ((17 <= ssc__core__var__type_id<Source> && ssc__core__var__type_id<Source> <= 24) || (32 <= ssc__core__var__type_id<Source> && ssc__core__var__type_id<Source> <= 34)))
inline Target ssc__core__fn__convert_number(Source value, const char* type_name_pointer) {
  if (!ssc__core__fn__is_exact_number<Target>(value)) [[unlikely]] {
    ssc__core__fn__throw_number_conversion_error(ssc__core__fn__number_text(value), type_name_pointer);
  }

  if constexpr (ssc__core__var__type_id<Source> == ssc__core__var__type_id<ssc__core__type__number>) {
    return static_cast<Target>(static_cast<ssc__core__type__f64>(value));
  } else {
    return static_cast<Target>(value);
  }
}

template <typename Index>
  requires(ssc__core__var__type_id<Index> == 24 || ssc__core__var__type_id<Index> == 34)
[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_index_error(Index index, ssc__core__type__u64 length) {
  ssc__core__fn__throw_message("RangeError: Index " + ssc__core__fn__number_text(index) + " is out of bounds for length " + std::to_string(length));
}

export template <typename Element, typename Index>
  requires(ssc__core__var__type_id<Index> == 24 || ssc__core__var__type_id<Index> == 34)
inline Element ssc__core__fn__array_set(const ssc__core__type__ref& array, Index index, Element value) {
  ssc__core__struct__array<Element>* array_pointer = ssc__core__fn__get_array_pointer<Element>(array);
  const ssc__core__type__u64 position = ssc__core__fn__to_array_position(index);

  if (position >= array_pointer->ssc__core__member__length) [[unlikely]] {
    ssc__core__fn__throw_index_error(index, array_pointer->ssc__core__member__length);
  }

  array_pointer->ssc__core__member__elements_pointer[position] = value;

  return value;
}

export template <typename Element, typename... Values> inline ssc__core__type__u64 ssc__core__fn__array_push(const ssc__core__type__ref& array, Values&&... values) {
  ssc__core__struct__array<Element>* array_pointer = ssc__core__fn__get_array_pointer<Element>(array);

  ssc__core__fn__array_reserve(array_pointer, array_pointer->ssc__core__member__length + sizeof...(Values));
  (std::construct_at(array_pointer->ssc__core__member__elements_pointer + array_pointer->ssc__core__member__length++, static_cast<Values&&>(values)), ...);

  return array_pointer->ssc__core__member__length;
}

export template <typename Element> inline ssc__core__type__union ssc__core__fn__array_pop(const ssc__core__type__ref& array) {
  ssc__core__struct__array<Element>* array_pointer = ssc__core__fn__get_array_pointer<Element>(array);

  if (array_pointer->ssc__core__member__length == 0) {
    return ssc__core__type__union(ssc__core__var__undefined);
  }

  Element* element_pointer = array_pointer->ssc__core__member__elements_pointer + --array_pointer->ssc__core__member__length;
  Element element = static_cast<Element&&>(*element_pointer);

  std::destroy_at(element_pointer);

  return ssc__core__type__union(static_cast<Element&&>(element));
}

template <typename Type> inline Type ssc__core__fn__union_to(const ssc__core__type__union& value) {
  if constexpr (__is_same(Type, ssc__core__type__union)) {
    return value;
  } else if constexpr (__is_same(Type, ssc__core__type__ref)) {
    return ssc__core__fn__union_to_ref(value);
  } else if constexpr (__is_same(Type, ssc__core__type__boolean)) {
    return ssc__core__fn__union_to_boolean(value);
  } else if constexpr (__is_same(Type, ssc__core__type__undefined)) {
    return ssc__core__fn__union_to_undefined(value);
  } else if constexpr (__is_same(Type, ssc__core__type__null)) {
    return ssc__core__fn__union_to_null(value);
  } else {
    return ssc__core__fn__union_to_number<Type>(value);
  }
}

template <typename Element> inline ssc__core__type__union ssc__core__fn__array_callback(const ssc__core__type__ref& callback, const ssc__core__type__ref& array, ssc__core__type__u64 index) {
  const ssc__core__type__union arguments[] = {
      ssc__core__type__union(Element(ssc__core__fn__get_array_pointer<Element>(array)->ssc__core__member__elements_pointer[index])),
      ssc__core__type__union(ssc__core__type__number(static_cast<ssc__core__type__f64>(index))),
      ssc__core__type__union(ssc__core__type__ref(array)),
  };

  return ssc__core__fn__call_span(callback, {3, arguments});
}

template <typename Element> inline ssc__core__type__boolean ssc__core__fn__is_array_index(const ssc__core__type__ref& array, ssc__core__type__u64 index) noexcept {
  return index < ssc__core__fn__get_array_pointer<Element>(array)->ssc__core__member__length;
}

export template <typename Element> inline void ssc__core__fn__array_for_each(const ssc__core__type__ref& array, const ssc__core__type__ref& callback) {
  const ssc__core__type__u64 length = ssc__core__fn__array_length(array);

  for (ssc__core__type__u64 index = 0; index < length && ssc__core__fn__is_array_index<Element>(array, index); index++) {
    ssc__core__fn__array_callback<Element>(callback, array, index);
  }
}

export template <typename Element, typename Result> inline ssc__core__type__ref ssc__core__fn__array_map(const ssc__core__type__ref& array, const ssc__core__type__ref& callback) {
  const ssc__core__type__u64 length = ssc__core__fn__array_length(array);
  ssc__core__type__ref result = ssc__core__fn__array_of<Result>();

  ssc__core__fn__array_reserve(ssc__core__fn__get_array_pointer<Result>(result), length);

  for (ssc__core__type__u64 index = 0; index < length && ssc__core__fn__is_array_index<Element>(array, index); index++) {
    ssc__core__fn__array_push<Result>(result, ssc__core__fn__union_to<Result>(ssc__core__fn__array_callback<Element>(callback, array, index)));
  }

  return result;
}

export template <typename Element> inline ssc__core__type__ref ssc__core__fn__array_filter(const ssc__core__type__ref& array, const ssc__core__type__ref& callback) {
  const ssc__core__type__u64 length = ssc__core__fn__array_length(array);
  ssc__core__type__ref result = ssc__core__fn__array_of<Element>();

  for (ssc__core__type__u64 index = 0; index < length && ssc__core__fn__is_array_index<Element>(array, index); index++) {
    if (ssc__core__fn__truthy_union(ssc__core__fn__array_callback<Element>(callback, array, index))) {
      ssc__core__fn__array_push<Element>(result, Element(ssc__core__fn__get_array_pointer<Element>(array)->ssc__core__member__elements_pointer[index]));
    }
  }

  return result;
}

export template <typename Element> inline ssc__core__type__union ssc__core__fn__array_reduce(const ssc__core__type__ref& array, const ssc__core__type__ref& callback, ssc__core__type__union initial) {
  const ssc__core__type__u64 length = ssc__core__fn__array_length(array);
  ssc__core__type__union accumulator = static_cast<ssc__core__type__union&&>(initial);

  for (ssc__core__type__u64 index = 0; index < length && ssc__core__fn__is_array_index<Element>(array, index); index++) {
    const ssc__core__type__union arguments[] = {
        accumulator,
        ssc__core__type__union(Element(ssc__core__fn__get_array_pointer<Element>(array)->ssc__core__member__elements_pointer[index])),
        ssc__core__type__union(ssc__core__type__number(static_cast<ssc__core__type__f64>(index))),
        ssc__core__type__union(ssc__core__type__ref(array)),
    };

    accumulator = ssc__core__fn__call_span(callback, {4, arguments});
  }

  return accumulator;
}

export template <typename Element> inline ssc__core__type__union ssc__core__fn__array_find(const ssc__core__type__ref& array, const ssc__core__type__ref& callback) {
  const ssc__core__type__u64 length = ssc__core__fn__array_length(array);

  for (ssc__core__type__u64 index = 0; index < length && ssc__core__fn__is_array_index<Element>(array, index); index++) {
    if (ssc__core__fn__truthy_union(ssc__core__fn__array_callback<Element>(callback, array, index))) {
      return ssc__core__fn__array_get<Element>(array, index);
    }
  }

  return ssc__core__type__union(ssc__core__var__undefined);
}

export template <typename Element> inline ssc__core__type__boolean ssc__core__fn__array_some(const ssc__core__type__ref& array, const ssc__core__type__ref& callback) {
  const ssc__core__type__u64 length = ssc__core__fn__array_length(array);

  for (ssc__core__type__u64 index = 0; index < length && ssc__core__fn__is_array_index<Element>(array, index); index++) {
    if (ssc__core__fn__truthy_union(ssc__core__fn__array_callback<Element>(callback, array, index))) {
      return true;
    }
  }

  return false;
}

export template <typename Element> inline ssc__core__type__boolean ssc__core__fn__array_every(const ssc__core__type__ref& array, const ssc__core__type__ref& callback) {
  const ssc__core__type__u64 length = ssc__core__fn__array_length(array);

  for (ssc__core__type__u64 index = 0; index < length && ssc__core__fn__is_array_index<Element>(array, index); index++) {
    if (!ssc__core__fn__truthy_union(ssc__core__fn__array_callback<Element>(callback, array, index))) {
      return false;
    }
  }

  return true;
}

export template <typename Element> inline ssc__core__type__i64 ssc__core__fn__array_index_of(const ssc__core__type__ref& array, const Element& value) {
  const ssc__core__struct__array<Element>* array_pointer = ssc__core__fn__get_array_pointer<Element>(array);

  for (ssc__core__type__u64 index = 0; index < array_pointer->ssc__core__member__length; index++) {
    const Element& element = array_pointer->ssc__core__member__elements_pointer[index];

    if constexpr (__is_same(Element, ssc__core__type__ref) || __is_same(Element, ssc__core__type__union)) {
      if (ssc__core__fn__strict_equals(element, value)) {
        return static_cast<ssc__core__type__i64>(index);
      }
    } else if (element == value) {
      return static_cast<ssc__core__type__i64>(index);
    }
  }

  return -1;
}

inline void ssc__core__fn__write_text(std::ostream& stream, const ssc__core__type__ref& text) {
  if (ssc__core__fn__is_bstring(text)) {
    const ssc__core__struct__bstring* bstring_pointer = ssc__core__fn__get_bstring_pointer(text);

    stream.write(reinterpret_cast<const char*>(bstring_pointer->ssc__core__member__bytes), bstring_pointer->ssc__core__member__length);
    return;
  }

  const std::string bytes = ssc__core__fn__text_to_utf8(text);

  stream.write(bytes.data(), bytes.size());
}

export inline void ssc__core__fn__write_stdout(const ssc__core__type__ref& text) {
  ssc__core__fn__write_text(std::cout, text);
}

export inline void ssc__core__fn__write_stderr(const ssc__core__type__ref& text) {
  ssc__core__fn__write_text(std::cerr, text);
}

export inline void ssc__core__fn__write_stdout(std::string_view string_view) noexcept {
  std::cout.write(string_view.data(), string_view.size());
}

export inline void ssc__core__fn__write_stderr(std::string_view string_view) noexcept {
  std::cerr.write(string_view.data(), string_view.size());
}

template <typename... Types> inline void ssc__core__fn__write_line(std::ostream& stream, const Types&... values) {
  ssc__core__type__boolean is_first = true;

  (
      [&] {
        const ssc__core__type__ref text = ssc__core__fn__console_string(values);

        if (!is_first) {
          stream.put(' ');
        }

        is_first = false;
        ssc__core__fn__write_text(stream, text);
      }(),
      ...);

  stream.put('\n');
}

export [[noreturn]] inline void ssc__core__fn__throw_value(const ssc__core__type__union& value) {
  throw value;
}

export inline void ssc__core__fn__report_uncaught(const ssc__core__type__union& value) {
  ssc__core__fn__write_line(std::cerr, value);
}

export template <typename... Types> inline void ssc__core__fn__console_log(const Types&... values) {
  ssc__core__fn__write_line(std::cout, values...);
}

export template <typename... Types> inline void ssc__core__fn__console_error(const Types&... values) {
  ssc__core__fn__write_line(std::cerr, values...);
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_tdz_error(const char* var_name_pointer) {
  ssc__core__fn__throw_message(std::string("ReferenceError: Cannot access '") + var_name_pointer + "' before initialization");
}

export inline void ssc__core__fn__throw_if_tdz(ssc__core__type__boolean is_initialized, const char* var_name_pointer) {
  if (!is_initialized) [[unlikely]] {
    ssc__core__fn__throw_tdz_error(var_name_pointer);
  }
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_overflow_error(const char* type_name_pointer) {
  ssc__core__fn__throw_message(std::string("RangeError: Overflow: ") + type_name_pointer);
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_division_by_zero_error(const char* type_name_pointer) {
  ssc__core__fn__throw_message(std::string("RangeError: Division by zero: ") + type_name_pointer);
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
inline Type ssc__core__fn__add_wrap(Type left, Type right) {
  Type result;
  __builtin_add_overflow(left, right, __builtin_addressof(result));
  return result;
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__sub_wrap(Type left, Type right) {
  Type result;
  __builtin_sub_overflow(left, right, __builtin_addressof(result));
  return result;
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__mul_wrap(Type left, Type right) {
  Type result;
  __builtin_mul_overflow(left, right, __builtin_addressof(result));
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

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__increment_prefix(Type& target, const char* type_name_pointer) {
  target = ssc__core__fn__add(target, static_cast<Type>(1), type_name_pointer);
  return target;
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__increment_postfix(Type& target, const char* type_name_pointer) {
  const Type previous = target;
  target = ssc__core__fn__add(previous, static_cast<Type>(1), type_name_pointer);
  return previous;
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__decrement_prefix(Type& target, const char* type_name_pointer) {
  target = ssc__core__fn__sub(target, static_cast<Type>(1), type_name_pointer);
  return target;
}

export template <typename Type>
  requires(17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24)
inline Type ssc__core__fn__decrement_postfix(Type& target, const char* type_name_pointer) {
  const Type previous = target;
  target = ssc__core__fn__sub(previous, static_cast<Type>(1), type_name_pointer);
  return previous;
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_shift_count_error(const char* type_name_pointer) {
  ssc__core__fn__throw_message(std::string("RangeError: Shift count out of range: ") + type_name_pointer);
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
inline Type ssc__core__fn__bitwise_not(Type value) {
  return static_cast<Type>(~value);
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

inline ssc__core__type__u32 ssc__core__fn__number_to_u32(ssc__core__type__number number) noexcept {
  const ssc__core__type__f64 value = static_cast<ssc__core__type__f64>(number);

  if (!__builtin_isfinite(value)) {
    return 0;
  }

  const ssc__core__type__f64 modulo = __builtin_fmod(__builtin_trunc(value), 4294967296.0);

  return static_cast<ssc__core__type__u32>(modulo < 0 ? modulo + 4294967296.0 : modulo);
}

inline ssc__core__type__i32 ssc__core__fn__number_to_i32(ssc__core__type__number number) noexcept {
  return static_cast<ssc__core__type__i32>(ssc__core__fn__number_to_u32(number));
}

export inline ssc__core__type__number ssc__core__fn__bitwise_and(ssc__core__type__number left, ssc__core__type__number right) noexcept {
  return ssc__core__type__number(ssc__core__fn__number_to_i32(left) & ssc__core__fn__number_to_i32(right));
}

export inline ssc__core__type__number ssc__core__fn__bitwise_or(ssc__core__type__number left, ssc__core__type__number right) noexcept {
  return ssc__core__type__number(ssc__core__fn__number_to_i32(left) | ssc__core__fn__number_to_i32(right));
}

export inline ssc__core__type__number ssc__core__fn__bitwise_xor(ssc__core__type__number left, ssc__core__type__number right) noexcept {
  return ssc__core__type__number(ssc__core__fn__number_to_i32(left) ^ ssc__core__fn__number_to_i32(right));
}

export inline ssc__core__type__number ssc__core__fn__bitwise_not(ssc__core__type__number value) noexcept {
  return ssc__core__type__number(~ssc__core__fn__number_to_i32(value));
}

export inline ssc__core__type__number ssc__core__fn__shift_left(ssc__core__type__number left, ssc__core__type__number right, const char*) noexcept {
  return ssc__core__type__number(static_cast<ssc__core__type__i32>(ssc__core__fn__number_to_u32(left) << (ssc__core__fn__number_to_u32(right) & 31)));
}

export inline ssc__core__type__number ssc__core__fn__shift_right(ssc__core__type__number left, ssc__core__type__number right, const char*) noexcept {
  return ssc__core__type__number(ssc__core__fn__number_to_i32(left) >> (ssc__core__fn__number_to_u32(right) & 31));
}

export inline ssc__core__type__number ssc__core__fn__unsigned_shift_right(ssc__core__type__number left, ssc__core__type__number right, const char*) noexcept {
  return ssc__core__type__number(ssc__core__fn__number_to_u32(left) >> (ssc__core__fn__number_to_u32(right) & 31));
}

[[noreturn]] [[gnu::noinline]] [[gnu::cold]] inline void ssc__core__fn__throw_code_point_error(const std::string& text) {
  ssc__core__fn__throw_message("RangeError: Invalid code point " + text);
}

template <typename Type>
  requires((17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24) || (32 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 34))
inline constexpr ssc__core__type__boolean ssc__core__fn__is_code_point(Type value) noexcept {
  if constexpr (ssc__core__var__type_id<Type> == ssc__core__var__type_id<ssc__core__type__number>) {
    return ssc__core__fn__is_code_point(static_cast<ssc__core__type__f64>(value));
  } else {
    if (!(0 <= value && value <= 0x10FFFF)) {
      return false;
    }

    if constexpr (32 <= ssc__core__var__type_id<Type>) {
      if (__builtin_trunc(value) != value) {
        return false;
      }
    }

    return !(0xD800 <= value && value <= 0xDFFF);
  }
}

export template <typename Type>
  requires((17 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 24) || (32 <= ssc__core__var__type_id<Type> && ssc__core__var__type_id<Type> <= 34))
inline ssc__core__type__char ssc__core__fn__char(Type value) {
  if (!ssc__core__fn__is_code_point(value)) [[unlikely]] {
    ssc__core__fn__throw_code_point_error(ssc__core__fn__number_text(value));
  }

  if constexpr (ssc__core__var__type_id<Type> == ssc__core__var__type_id<ssc__core__type__number>) {
    return static_cast<ssc__core__type__char>(static_cast<ssc__core__type__f64>(value));
  } else {
    return static_cast<ssc__core__type__char>(value);
  }
}

export inline ssc__core__type__char ssc__core__fn__char(const ssc__core__type__ref& string) {
  const ssc__core__struct__string* string_pointer = ssc__core__fn__get_string_pointer(string);
  const ssc__core__type__u16* units = string_pointer->ssc__core__member__units;
  const ssc__core__type__u64 length = string_pointer->ssc__core__member__length;
  const ssc__core__type__boolean is_pair = length == 2 && 0xD800 <= units[0] && units[0] <= 0xDBFF && 0xDC00 <= units[1] && units[1] <= 0xDFFF;

  if (length != 1 && !is_pair) [[unlikely]] {
    ssc__core__fn__throw_code_point_error("'" + ssc__core__fn__text_to_utf8(string) + "'");
  }

  const ssc__core__type__u32 code_point = is_pair ? 0x10000 + ((units[0] - 0xD800) << 10) + (units[1] - 0xDC00) : units[0];

  return ssc__core__fn__char(code_point);
}
