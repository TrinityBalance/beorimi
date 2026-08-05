from .api import app
from .cli import run_cli

__all__ = ["app", "run_cli"]


if __name__ == "__main__":
    run_cli()
