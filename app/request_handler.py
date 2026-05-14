import requests
import json
import logging
import os
import base64
import re

logger = logging.getLogger(__name__)

API_BASE_URL_CREATE_TICKET= "https://ticketing.tvtworld.com//CZCRM/api/create_ticket.php"
API_BASE_URL_GET_TICKET = "https://ticketing.tvtworld.com/CZCRM/api/get_ticket_data.php"
CLIENT_KEY = "1986649354831659008"


# def call_create_ticket(user_id: int, mail_id: str, subject: str, body: str, status: str) -> dict:

#     try:
#         # Prepare JSON payload
#         payload = {
#             "client_key": CLIENT_KEY,
#             "ticket_type": "Complaint",
#             "disposition": "dispoone",
#             "sub_disposition": "subdispoone",
#             "description": body,
#             "agent_remarks": "Test remarks",
#             "ticket_status": "New",
#             "priority_name": "Critical",
#             "person_name": "Monish",
#             "first_name": "Mohd",
#             "last_name": "Monish",
#             "mobile_no": "9876543210",
#             "email": mail_id,
#             "source": "api",
#             "source_info": "9876543210"
#         }

#         # Remove empty fields (optional but cleaner)
#         payload = {k: v for k, v in payload.items() if v}

#         # Convert to JSON string
#         json_str = json.dumps(payload)

#         # Base64 encode
#         encoded_data = base64.b64encode(json_str.encode()).decode()

#         # Final URL
#         url = f"{API_BASE_URL}?data={encoded_data}"

#         logger.info(f"📤 Calling Create Ticket API")

#         # GET request
#         response = requests.get(url, timeout=10)
#         response.raise_for_status()

#         result = response.json()

#         # Handle response
#         if result.get("Status") == "Success":
#             return {
#                 "success": True,
#                 "message": result.get("Message")
#             }
#         else:
#             return {
#                 "success": False,
#                 "error": result.get("Message")
#             }

#     except requests.exceptions.RequestException as e:
#         logger.error(f"❌ API failed: {e}")
#         return {"success": False, "error": str(e)}

def call_create_ticket(user_id: int, mail_id: str, subject: str, body: str, status: str) -> dict:

    try:
        payload = {
            "client_key": CLIENT_KEY,
            "ticket_type": "Complaint",
            "disposition": "dispoone",
            "sub_disposition": "subdispoone",
            "description": body,
            "agent_remarks": "Test remarks",
            "ticket_status": "New",
            "priority_name": "Critical",
            "person_name": "Monish",
            "first_name": "Mohd",
            "last_name": "Monish",
            "mobile_no": "9876543210",
            "email": mail_id,
            "source": "api",
            "source_info": "9876543210"
        }

        payload = {k: v for k, v in payload.items() if v}

        json_str = json.dumps(payload)
        encoded_data = base64.b64encode(json_str.encode()).decode()

        url = f"{API_BASE_URL_CREATE_TICKET}?data={encoded_data}"

        logger.info(f"📤 Calling Create Ticket API")

        response = requests.get(url, timeout=10)
        response.raise_for_status()

        result = response.json()

        # 🔥 Extract ticket ID
        ticket_id = None
        ref_text = result.get("Refrence_No") or result.get("Message", "")

        match = re.search(r"T-\d{6}-\d+", ref_text)
        if match:
            ticket_id = match.group()

        # ✅ Final return
        if result.get("Status") == "Success":
            return {
                "success": True,
                "ticket_id": ticket_id,
                "message": result.get("Message")
            }
        else:
            return {
                "success": False,
                "ticket_id": None,
                "error": result.get("Message")
            }

    except requests.exceptions.RequestException as e:
        logger.error(f"❌ API failed: {e}")
        return {
            "success": False,
            "ticket_id": None,
            "error": str(e)
        }

# ==============================
# 📦 Order Status API
# ==============================
def get_order_status(order_id: str) -> dict:
    try:
        # 🔹 Filter only with docket_no
        payload = {
            "client_key": CLIENT_KEY,
            "filter": {
                "docket_no": order_id,
                "create_date_flag": "true"
            }
        }

        # 🔹 Encode payload
        json_str = json.dumps(payload)
        encoded_data = base64.b64encode(json_str.encode()).decode()
    
        # 🔹 Final URL
        url = f"{API_BASE_URL_GET_TICKET}?postData={encoded_data}"

        logger.info(f"📤 Calling Order Status API for {order_id}")

        # 🔹 API Call
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        result = response.json()

        # 🔹 Handle response
        if "Success" in result:
            return {
                "success": True,
                "data": result.get("Success")
            }
        else:
            return {
                "success": False,
                "error": result.get("Failure")
            }

    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Order API failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }
