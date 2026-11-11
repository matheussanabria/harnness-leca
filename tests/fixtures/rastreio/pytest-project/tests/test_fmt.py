from app.fmt import money


def test_money_two_decimals():
    assert money(1) == "1.00"
