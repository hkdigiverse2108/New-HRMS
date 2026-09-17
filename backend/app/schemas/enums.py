from enum import Enum

class SystemRole(str, Enum):
    ADMIN = "Admin"
    EMPLOYEE = "Employee"

class GenderEnum(str, Enum):
    MALE = "Male"
    FEMALE = "Female"
    OTHER = "Other"

class RelationEnum(str, Enum):
    FATHER = "Father"
    MOTHER = "Mother"
    SPOUSE = "Spouse"
    SIBLING = "Sibling"
    OTHER = "Other"

class WorkModeEnum(str, Enum):
    WFO = "WFO"
    WFH = "WFH"
    HYBRID = "Hybrid"

class AttendanceStatusEnum(str, Enum):
    PRESENT = "Present"
    ABSENT = "Absent"
    LATE = "Late"
    ON_LEAVE = "On Leave"
    LOGGED = "Logged"
    ACTIVE = "Active"
    ON_BREAK = "On Break"

class LeaveTypeEnum(str, Enum):
    ANNUAL = "Annual Leave"
    SICK = "Sick Leave"
    CASUAL = "Casual Leave"
    MONTHLY = "Monthly Leave"

class DayTypeEnum(str, Enum):
    FULL_DAY = "Full Day"
    HALF_DAY = "Half Day"
    FIRST_HALF = "First Half"
    SECOND_HALF = "Second Half"

class LeaveStatusEnum(str, Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"

