from pydantic import BaseModel, EmailStr


class SendOtpRequest(BaseModel):
    # The email address to send the OTP code to
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    # The email address the code was sent to
    email: EmailStr
    # The 6-digit code the user received
    code: str


class TokenResponse(BaseModel):
    # The JWT token returned after successful verification
    access_token: str
    token_type: str = "bearer"