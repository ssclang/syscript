# @syscript/cli completion

`CommandNode` is the single source for command names, aliases, arguments, options, help and execution. Add optional `complete` metadata to an argument or option for suggestions:

```ts
import { createCommand, runCli } from '@syscript/cli';

const command = createCommand({
  name: 'ssc-cli',
  args: [{ name: 'entry', type: 'string', complete: 'file' }],
  options: [{ name: 'profile', type: 'string', complete: ['dev', 'release'] }],
  run: (args, options) => {
    // Application behavior remains here.
    return 0;
  },
});

await runCli(command, { completion: true });
```

`complete` accepts a list of strings, `'file'`, or `'directory'`. Suggestions do not validate the value when the command executes. Completion is off by default, so an existing positional argument called `complete` retains its behavior until the application opts in. With completion enabled, `ssc-cli complete zsh` prints a registration script and `ssc-cli complete -- ...` answers shell requests without running the command. The generated script calls `ssc-cli` by name, so it must resolve to an installed command or shell function whenever the shell requests candidates.

For a consumer using Zsh, capture and register the script in the current session after installing your CLI:

```zsh
ssc-cli complete zsh > ./ssc-cli-completion.zsh && source ./ssc-cli-completion.zsh
```

Script generation also accepts `bash`, `fish`, and `powershell`. Bash requires `bash-completion` for `_get_comp_words_by_ref`. The package does not install tab's separate package-manager CLI or edit shell profiles.

For a grouped Zsh display, opt in when generating its script:

```zsh
ssc-cli complete zsh --grouped > ./ssc-cli-completion.zsh && source ./ssc-cli-completion.zsh
```

This adds styles scoped to `ssc-cli`: described options appear one per line under **Options**, built-in flags under **General**, and positional paths under **Files**. Zsh sorts names within each group. Group membership comes from the command's option and alias definitions. When a completion value has the same text as a flag, it remains completable without a potentially incorrect group heading. The styles do not change completion for other commands. All accepted aliases remain available.

For a one-command local Zsh setup of the **CLI example**, run from the repository root:

```zsh
source package/cli/setup.zsh
```

This reconciles dependencies with the frozen workspace lock, builds share and CLI in dependency order, runs CLI tests, checks the compiler source help command, and registers grouped `ssc-cli` completion for the current shell session. It leaves shell profiles untouched. Run `ssc-cli --help`, then try `ssc-cli --<TAB>`, `ssc-cli --profile=<TAB>`, and `ssc-cli ./<TAB>`. The example is in `test/fixture.ts` and prints its arguments; it does not compile or run a user program.

After changing the CLI, source the setup command again in the same Zsh session to replace its previous completion registration. The example also lists `--no-d` because its `dry` option defines that negative alias.

The real compiler `ssc` is **not yet wired to completion**: its current source does not opt in or define value suggestions. Enabling it requires changes to the compiler's command definition.

The adapter uses tab for shell registration scripts and directive constants. Syscript calculates candidates using its own parser rules and serializes them into tab's `value<TAB>description` protocol because tab's public parser cannot express Syscript's alias/argument rules or file directive. In tab 0.0.22, generated Bash and Zsh callbacks split quoted arguments containing spaces. Bash `--option=value` insertion and file fallback also have known limitations. Bash needs `bash-completion` for `_get_comp_words_by_ref`; Fish and PowerShell scripts are generated but have not been exercised here. Package-manager delegation requires users to install and activate tab's separate package-manager CLI and may not preserve file directives. This is a Node CLI feature; it does not make a future `ssc` native executable independent of Node.
