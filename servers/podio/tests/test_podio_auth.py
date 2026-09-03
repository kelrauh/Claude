"""Tests for the one-time authorization helper's parsing and mode selection."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from podio_auth import extract_code, is_loopback, write_token  # noqa: E402

STATE = "s-123"


@pytest.mark.parametrize(
    "uri",
    [
        "http://localhost:8080/podio-callback",
        "http://127.0.0.1:9000/cb",
        "http://[::1]:8080/cb",
    ],
)
def test_loopback_uris_are_caught_locally(uri):
    assert is_loopback(uri) is True


@pytest.mark.parametrize(
    "uri",
    ["https://claude.ai/podio-callback", "https://mypodioapp.com/cb", "https://localhost.evil.com/cb"],
)
def test_other_uris_fall_back_to_pasting(uri):
    assert is_loopback(uri) is False


def test_extract_code_from_a_full_url():
    url = f"https://claude.ai/podio-callback?code=abc123&state={STATE}"
    assert extract_code(url, STATE) == "abc123"


def test_extract_code_tolerates_surrounding_quotes_and_space():
    url = f'  "https://claude.ai/cb?code=abc123&state={STATE}"  '
    assert extract_code(url, STATE) == "abc123"


def test_extract_code_accepts_a_bare_query_string():
    assert extract_code(f"code=abc123&state={STATE}", STATE) == "abc123"


def test_state_mismatch_is_refused():
    url = f"https://claude.ai/cb?code=abc123&state=other"
    with pytest.raises(SystemExit, match="State mismatch"):
        extract_code(url, STATE)


def test_missing_state_is_refused():
    with pytest.raises(SystemExit, match="State mismatch"):
        extract_code("https://claude.ai/cb?code=abc123", STATE)


def test_podio_error_in_the_url_is_reported():
    url = f"https://claude.ai/cb?error=access_denied&error_description=User+said+no&state={STATE}"
    with pytest.raises(SystemExit, match="User said no"):
        extract_code(url, STATE)


def test_url_without_a_query_string_explains_what_to_copy():
    with pytest.raises(SystemExit, match="no query string"):
        extract_code("https://claude.ai/podio-callback", STATE)


def test_empty_input_is_rejected():
    with pytest.raises(SystemExit, match="Nothing pasted"):
        extract_code("   ", STATE)


def test_written_token_file_is_owner_only(tmp_path):
    path = tmp_path / "t.json"
    write_token(path, "secret-refresh")
    assert '"refresh_token": "secret-refresh"' in path.read_text()
    assert path.stat().st_mode & 0o777 == 0o600


def test_code_url_without_state_is_refused():
    from podio_auth import authorize

    with pytest.raises(SystemExit, match="--state"):
        authorize("cid", "secret", "https://claude.ai/cb", "https://api.podio.com", 1,
                  code_url="https://claude.ai/cb?code=x&state=y")
