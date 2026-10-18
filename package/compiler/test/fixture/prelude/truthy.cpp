import ssc;

extern "C" void* malloc(__SIZE_TYPE__ size) noexcept;

struct Plain {
  ssc__core__struct__object_header objectHeader;
};

static const ssc__core__struct__shape plainShape{};
static const ssc__core__struct__descriptor plainDescriptor{&plainShape};

static ssc__core__struct__object_header* makeString(ssc__core__type__u64 length) {
  auto* data = static_cast<ssc__core__struct__string*>(malloc(sizeof(ssc__core__struct__string) + length));
  data->ssc__core__member__object_header.ssc__core__member__rc = 1;
  data->ssc__core__member__object_header.ssc__core__member__descriptor_pointer = &ssc__core__var__string_descriptor;
  data->ssc__core__member__length = length;
  __builtin_memset(data->ssc__core__member__bytes, 'a', length);
  return &data->ssc__core__member__object_header;
}

static ssc__core__struct__object_header* makePlain() {
  auto* data = static_cast<Plain*>(malloc(sizeof(Plain)));
  data->objectHeader.ssc__core__member__rc = 1;
  data->objectHeader.ssc__core__member__descriptor_pointer = &plainDescriptor;
  return &data->objectHeader;
}

static int check(bool condition, int code) {
  return condition ? 0 : code;
}

int main() {
  if (int code = check(!ssc__core__fn__truthy_union(ssc__core__type__union(ssc__core__type__ref(makeString(0)))), 1)) {
    return code;
  }
  if (int code = check(ssc__core__fn__truthy_union(ssc__core__type__union(ssc__core__type__ref(makeString(1)))), 2)) {
    return code;
  }
  if (int code = check(ssc__core__fn__truthy_union(ssc__core__type__union(ssc__core__type__ref(makePlain()))), 3)) {
    return code;
  }
  if (int code = check(!ssc__core__fn__truthy_union(ssc__core__type__union(ssc__core__var__undefined)), 4)) {
    return code;
  }
  if (int code = check(!ssc__core__fn__truthy_union(ssc__core__type__union(ssc__core__type__i32{0})), 5)) {
    return code;
  }
  if (int code = check(ssc__core__fn__truthy_union(ssc__core__type__union(ssc__core__type__i8{-1})), 6)) {
    return code;
  }
  if (int code = check(!ssc__core__fn__truthy_union(ssc__core__type__union(ssc__core__type__f64{__builtin_nan("")})), 7)) {
    return code;
  }
  return 0;
}
