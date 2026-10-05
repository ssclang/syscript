# Source this file from zsh: source package/cli/setup.zsh
_syscript_cli_setup() {
  local script_path=${(%):-%x}
  local repo_root=${script_path:A:h:h:h}
  local completion_file

  if ! (
    cd "$repo_root" || exit 1
    pnpm install --frozen-lockfile || {
      print -u2 'Frozen dependency install failed; check the pnpm store configuration.'
      exit 1
    }
    pnpm --filter @syscript/share build || exit 1
    pnpm --filter @syscript/number build:dev || exit 1
    pnpm --filter @syscript/cli build:dev || exit 1
    pnpm --filter @syscript/cli test || exit 1
    cd package/compiler || exit 1
    NODE_ENV=development node --import tsx src/main.ts --help > /dev/null || exit 1
  ); then
    print -u2 'Syscript CLI setup failed; completion was not registered.'
    return 1
  fi

  if (( ! $+functions[compdef] )); then
    autoload -Uz compinit
    compinit -D || return 1
  fi

  typeset -g SYSCRIPT_CLI_ROOT="$repo_root"
  function ssc-cli() {
    (cd "$SYSCRIPT_CLI_ROOT/package/cli" && NODE_ENV=development node --import tsx test/fixture.ts "$@")
  }

  completion_file=$(mktemp "${TMPDIR:-/tmp}/ssc-cli.XXXXXX") || {
    unfunction ssc-cli
    return 1
  }
  if ! ssc-cli complete zsh > "$completion_file"; then
    rm -f -- "$completion_file"
    unfunction ssc-cli
    print -u2 'Could not generate the demo completion script.'
    return 1
  fi

  source "$completion_file"
  local result=$?
  rm -f -- "$completion_file"
  if (( result != 0 )); then
    unfunction ssc-cli
    return "$result"
  fi

  print 'Syscript CLI demo ready: ssc-cli --help'
}

if _syscript_cli_setup; then
  unfunction _syscript_cli_setup
else
  unfunction _syscript_cli_setup
  return 1
fi
