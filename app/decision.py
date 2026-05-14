def decision_engine(score):
    """
    Decision engine based on reply quality score.
    - score >= 80: auto_send email
    - score < 80: create_ticket for manual handling
    """
    if score >= 80:
        return "auto_send"
    else:
        return "create_ticket"
