import ssc;

extern "C" void* malloc(__SIZE_TYPE__ size) noexcept;

static int freeCount = 0;
static bool poisonOnFree = false;

extern "C" void free(void* pointer) noexcept {
  freeCount++;
  if (poisonOnFree) {
    __builtin_memset(pointer, 0xAB, 24);
  }
}

static ssc__core__struct__string* makeString(ssc__core__type__u64 refcount) {
  auto* data = static_cast<ssc__core__struct__string*>(malloc(sizeof(ssc__core__struct__string) + 1));
  data->ssc__core__member__object_header.ssc__core__member__rc = refcount;
  data->ssc__core__member__object_header.ssc__core__member__descriptor_pointer = &ssc__core__var__string_descriptor;
  data->ssc__core__member__length = 0;
  data->ssc__core__member__bytes[0] = 0;
  return data;
}

struct Big {
  ssc__core__type__u64 first;
  ssc__core__type__u64 second;
};

struct Parent {
  ssc__core__struct__object_header objectHeader;
  ssc__core__type__ref child;
  ssc__core__type__union value;
};

static const ssc__core__type__u64 parentRefOffsets[] = {__builtin_offsetof(Parent, child)};
static const ssc__core__type__u64 parentUnionOffsets[] = {__builtin_offsetof(Parent, value)};
static const ssc__core__struct__shape parentShape{{1, parentRefOffsets}, {1, parentUnionOffsets}};
static const ssc__core__struct__descriptor parentDescriptor{&parentShape};

struct RefNode {
  ssc__core__struct__object_header objectHeader;
  ssc__core__type__ref next;
};

static const ssc__core__type__u64 refNodeRefOffsets[] = {__builtin_offsetof(RefNode, next)};
static const ssc__core__struct__shape refNodeShape{{1, refNodeRefOffsets}, {}};
static const ssc__core__struct__descriptor refNodeDescriptor{&refNodeShape};

static RefNode* makeRefNode(ssc__core__struct__object_header* next) {
  auto* node = static_cast<RefNode*>(malloc(sizeof(RefNode)));
  RefNode initial{{1, &refNodeDescriptor}, ssc__core__type__ref(next)};
  __builtin_memcpy(static_cast<void*>(node), &initial, sizeof(RefNode));
  initial.next.ssc__core__member__detach();
  return node;
}

struct UnionNode {
  ssc__core__struct__object_header objectHeader;
  ssc__core__type__union next;
};

static const ssc__core__type__u64 unionNodeUnionOffsets[] = {__builtin_offsetof(UnionNode, next)};
static const ssc__core__struct__shape unionNodeShape{{}, {1, unionNodeUnionOffsets}};
static const ssc__core__struct__descriptor unionNodeDescriptor{&unionNodeShape};

static UnionNode* makeUnionNode(ssc__core__struct__object_header* next) {
  auto* node = static_cast<UnionNode*>(malloc(sizeof(UnionNode)));
  UnionNode initial{{1, &unionNodeDescriptor}, ssc__core__type__union(ssc__core__type__ref(next))};
  __builtin_memcpy(static_cast<void*>(node), &initial, sizeof(UnionNode));
  initial.next.ssc__core__member__type_id = 0;
  return node;
}

static int check(bool condition, int code) {
  return condition ? 0 : code;
}

int main() {
  static_assert(sizeof(ssc__core__type__ref) == 8);
  static_assert(ssc__core__var__type_id<ssc__core__type__ref> == 48);
  static_assert(__is_constructible(ssc__core__type__union, ssc__core__type__i32));
  static_assert(__is_constructible(ssc__core__type__union, ssc__core__type__ref));
  static_assert(!__is_constructible(ssc__core__type__union, Big));

  auto* data = makeString(1);
  {
    ssc__core__type__ref first(&data->ssc__core__member__object_header);
    {
      ssc__core__type__ref copy = first;
      if (int code = check(data->ssc__core__member__object_header.ssc__core__member__rc == 2, 1)) {
        return code;
      }
      ssc__core__type__ref moved = static_cast<ssc__core__type__ref&&>(copy);
      if (int code = check(data->ssc__core__member__object_header.ssc__core__member__rc == 2, 2)) {
        return code;
      }
    }
    if (int code = check(data->ssc__core__member__object_header.ssc__core__member__rc == 1 && freeCount == 0, 3)) {
      return code;
    }
  }
  if (int code = check(freeCount == 1, 4)) {
    return code;
  }

  auto* literal = makeString(0);
  {
    ssc__core__type__ref first(&literal->ssc__core__member__object_header);
    ssc__core__type__ref copy = first;
    if (int code = check(literal->ssc__core__member__object_header.ssc__core__member__rc == 0, 5)) {
      return code;
    }
  }
  if (int code = check(freeCount == 1 && literal->ssc__core__member__object_header.ssc__core__member__rc == 0, 6)) {
    return code;
  }

  auto* unionData = makeString(1);
  {
    ssc__core__type__union value(ssc__core__type__ref{&unionData->ssc__core__member__object_header});
    if (int code = check(value.ssc__core__member__type_id == 48 && unionData->ssc__core__member__object_header.ssc__core__member__rc == 1, 7)) {
      return code;
    }
    {
      ssc__core__type__union copy = value;
      if (int code = check(unionData->ssc__core__member__object_header.ssc__core__member__rc == 2, 8)) {
        return code;
      }
      ssc__core__type__union moved = static_cast<ssc__core__type__union&&>(copy);
      ssc__core__type__union target(ssc__core__type__i32{1});
      target = static_cast<ssc__core__type__union&&>(moved);
      if (int code = check(unionData->ssc__core__member__object_header.ssc__core__member__rc == 2 && copy.ssc__core__member__type_id == 0 && moved.ssc__core__member__type_id == 0 && target.ssc__core__member__type_id == 48, 9)) {
        return code;
      }
    }
    if (int code = check(unionData->ssc__core__member__object_header.ssc__core__member__rc == 1 && freeCount == 1, 10)) {
      return code;
    }
    value = ssc__core__type__union(ssc__core__type__i32{7});
    if (int code = check(freeCount == 2 && value.ssc__core__member__type_id == 19, 11)) {
      return code;
    }
    ssc__core__type__union number = value;
    if (int code = check(number.ssc__core__member__value.ssc__core__member__i32 == 7 && freeCount == 2, 12)) {
      return code;
    }
  }
  if (int code = check(freeCount == 2, 13)) {
    return code;
  }

  auto* child = makeString(1);
  auto* unionChild = makeString(1);
  auto* parent = static_cast<Parent*>(malloc(sizeof(Parent)));
  {
    Parent initial{{1, &parentDescriptor}, ssc__core__type__ref(&child->ssc__core__member__object_header), ssc__core__type__union(ssc__core__type__ref(&unionChild->ssc__core__member__object_header))};
    __builtin_memcpy(parent, &initial, sizeof(Parent));
    initial.child.ssc__core__member__detach();
    initial.value.ssc__core__member__type_id = 0;
  }
  {
    ssc__core__type__ref owner(&parent->objectHeader);
  }
  if (int code = check(freeCount == 5 && child->ssc__core__member__object_header.ssc__core__member__rc == 0 && unionChild->ssc__core__member__object_header.ssc__core__member__rc == 0, 14)) {
    return code;
  }

  auto* selfData = makeString(1);
  {
    ssc__core__type__ref self(&selfData->ssc__core__member__object_header);
    ssc__core__type__ref& alias = self;
    self = alias;
    self = static_cast<ssc__core__type__ref&&>(alias);
    if (int code = check(self.ssc__core__member__get_object_header_pointer() == &selfData->ssc__core__member__object_header && selfData->ssc__core__member__object_header.ssc__core__member__rc == 1 && freeCount == 5, 15)) {
      return code;
    }
  }
  if (int code = check(freeCount == 6, 16)) {
    return code;
  }

  auto* selfUnionData = makeString(1);
  {
    ssc__core__type__union self(ssc__core__type__ref(&selfUnionData->ssc__core__member__object_header));
    ssc__core__type__union& alias = self;
    self = alias;
    self = static_cast<ssc__core__type__union&&>(alias);
    if (int code = check(self.ssc__core__member__type_id == 48 && self.ssc__core__member__value.ssc__core__member__object_header_pointer == &selfUnionData->ssc__core__member__object_header && selfUnionData->ssc__core__member__object_header.ssc__core__member__rc == 1 && freeCount == 6, 17)) {
      return code;
    }
  }
  if (int code = check(freeCount == 7, 18)) {
    return code;
  }

  poisonOnFree = true;

  {
    auto* second = makeString(1);
    auto* first = makeRefNode(&second->ssc__core__member__object_header);
    ssc__core__type__ref node(&first->objectHeader);
    node = reinterpret_cast<RefNode*>(node.ssc__core__member__get_object_header_pointer())->next;
    if (int code = check(node.ssc__core__member__get_object_header_pointer() == &second->ssc__core__member__object_header && second->ssc__core__member__object_header.ssc__core__member__rc == 1 && freeCount == 8, 19)) {
      return code;
    }
  }

  {
    auto* second = makeString(1);
    auto* first = makeRefNode(&second->ssc__core__member__object_header);
    ssc__core__type__ref node(&first->objectHeader);
    node = static_cast<ssc__core__type__ref&&>(reinterpret_cast<RefNode*>(node.ssc__core__member__get_object_header_pointer())->next);
    if (int code = check(node.ssc__core__member__get_object_header_pointer() == &second->ssc__core__member__object_header && second->ssc__core__member__object_header.ssc__core__member__rc == 1 && freeCount == 10, 20)) {
      return code;
    }
  }

  {
    auto* second = makeString(1);
    auto* first = makeUnionNode(&second->ssc__core__member__object_header);
    ssc__core__type__union node(ssc__core__type__ref(&first->objectHeader));
    node = reinterpret_cast<UnionNode*>(node.ssc__core__member__value.ssc__core__member__object_header_pointer)->next;
    if (int code = check(node.ssc__core__member__type_id == 48 && node.ssc__core__member__value.ssc__core__member__object_header_pointer == &second->ssc__core__member__object_header && second->ssc__core__member__object_header.ssc__core__member__rc == 1 && freeCount == 12, 21)) {
      return code;
    }
  }

  {
    auto* second = makeString(1);
    auto* first = makeUnionNode(&second->ssc__core__member__object_header);
    ssc__core__type__union node(ssc__core__type__ref(&first->objectHeader));
    node = static_cast<ssc__core__type__union&&>(reinterpret_cast<UnionNode*>(node.ssc__core__member__value.ssc__core__member__object_header_pointer)->next);
    if (int code = check(node.ssc__core__member__type_id == 48 && node.ssc__core__member__value.ssc__core__member__object_header_pointer == &second->ssc__core__member__object_header && second->ssc__core__member__object_header.ssc__core__member__rc == 1 && freeCount == 14, 22)) {
      return code;
    }
  }

  return check(freeCount == 15, 23);
}
