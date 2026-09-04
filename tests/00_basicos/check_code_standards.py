import shutil
import subprocess
import sys
from pathlib import Path


def find_project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / 'index.html').exists() and (candidate / 'data').exists():
            return candidate
    raise RuntimeError('Project root not found.')


ROOT = find_project_root()


def check_python_standards():
    ruff_bin = shutil.which('ruff')
    if not ruff_bin:
        raise AssertionError("Ruff não está instalado. Execute 'python -m pip install -r requirements-dev.txt'.")

    print('Checking Python linting with Ruff...')
    res_lint = subprocess.run([ruff_bin, 'check', '.'], cwd=ROOT, capture_output=True, text=True)
    if res_lint.returncode != 0:
        print(res_lint.stdout)
        print(res_lint.stderr, file=sys.stderr)
        raise AssertionError("Python code style check (Ruff lint) failed. Run 'ruff check --fix .' to auto-fix.")

    print('Checking Python formatting with Ruff...')
    res_fmt = subprocess.run([ruff_bin, 'format', '--check', '.'], cwd=ROOT, capture_output=True, text=True)
    if res_fmt.returncode != 0:
        print(res_fmt.stdout)
        print(res_fmt.stderr, file=sys.stderr)
        raise AssertionError(
            "Python formatting check (Ruff format) failed. Run 'ruff format .' to format Python files."
        )

    print('Python code standards: OK')


def check_js_standards():
    node_modules = ROOT / 'node_modules'
    if not node_modules.exists():
        raise AssertionError("node_modules ausente. Execute 'npm ci'.")

    npm_bin = shutil.which('npm')
    if not npm_bin:
        raise AssertionError('npm não encontrado; a verificação JavaScript não pode ser executada.')

    print('Checking JavaScript linting (ESLint)...')
    res_lint = subprocess.run([npm_bin, 'run', 'lint:js'], cwd=ROOT, capture_output=True, text=True)
    if res_lint.returncode != 0:
        print(res_lint.stdout)
        print(res_lint.stderr, file=sys.stderr)
        raise AssertionError('JavaScript linting (ESLint) failed. Fix the issues or run formatting tools.')

    print('Checking JavaScript formatting (Prettier)...')
    res_fmt = subprocess.run([npm_bin, 'run', 'format:js:check'], cwd=ROOT, capture_output=True, text=True)
    if res_fmt.returncode != 0:
        print(res_fmt.stdout)
        print(res_fmt.stderr, file=sys.stderr)
        raise AssertionError(
            "JavaScript formatting (Prettier) failed. Run 'npm run format:js:write' to format JS files."
        )

    print('JavaScript code standards: OK')


def main():
    check_python_standards()
    check_js_standards()
    print('CODE_STANDARDS_CHECK_OK')


if __name__ == '__main__':
    main()
