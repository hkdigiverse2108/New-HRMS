export interface OrgNodeData {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
  status: 'Active' | 'On Leave' | 'Remote' | 'Inactive';
  children?: OrgNodeData[];
}

export const ORG_DATA: OrgNodeData = {
  id: "CEO-01",
  name: "Arjun Mehta",
  role: "Chief Executive Officer",
  department: "Executive",
  avatar: "https://i.pravatar.cc/150?u=arjun",
  status: "Active",
  children: [
    {
      id: "VP-01",
      name: "Riya Shah",
      role: "VP of Engineering",
      department: "Engineering",
      avatar: "https://i.pravatar.cc/150?u=riya",
      status: "Active",
      children: [
        {
          id: "ENG-01",
          name: "Vikram Singh",
          role: "Frontend Lead",
          department: "Engineering",
          avatar: "https://i.pravatar.cc/150?u=vikram",
          status: "Remote",
          children: [
            {
              id: "ENG-01-1",
              name: "Rahul Verma",
              role: "Frontend Developer",
              department: "Engineering",
              avatar: "https://i.pravatar.cc/150?u=rahul",
              status: "Active",
            },
            {
              id: "ENG-01-2",
              name: "Sneha Reddy",
              role: "UI Engineer",
              department: "Engineering",
              avatar: "https://i.pravatar.cc/150?u=sneha",
              status: "Active",
            }
          ]
        },
        {
          id: "ENG-02",
          name: "Karan Patel",
          role: "Backend Lead",
          department: "Engineering",
          avatar: "https://i.pravatar.cc/150?u=karan",
          status: "On Leave",
        }
      ]
    },
    {
      id: "VP-02",
      name: "Aarav Mehta",
      role: "VP of Sales",
      department: "Sales",
      avatar: "https://i.pravatar.cc/150?u=aarav",
      status: "Active",
      children: [
        {
          id: "SAL-01",
          name: "Neha Patel",
          role: "Regional Director",
          department: "Sales",
          avatar: "https://i.pravatar.cc/150?u=neha",
          status: "Active",
          children: [
            {
              id: "SAL-01-1",
              name: "Dev Trivedi",
              role: "Account Executive",
              department: "Sales",
              avatar: "https://i.pravatar.cc/150?u=dev",
              status: "Active",
            },
            {
              id: "SAL-01-2",
              name: "Kavya Iyer",
              role: "Sales Representative",
              department: "Sales",
              avatar: "https://i.pravatar.cc/150?u=kavya",
              status: "Remote",
            }
          ]
        }
      ]
    },
    {
      id: "VP-03",
      name: "Ananya Desai",
      role: "VP of HR",
      department: "Human Resources",
      avatar: "https://i.pravatar.cc/150?u=ananya",
      status: "Active",
      children: [
        {
          id: "HR-01",
          name: "Priya Sharma",
          role: "Recruitment Lead",
          department: "Human Resources",
          avatar: "https://i.pravatar.cc/150?u=priya",
          status: "Active",
        },
        {
          id: "HR-02",
          name: "Siddharth Rao",
          role: "Culture Manager",
          department: "Human Resources",
          avatar: "https://i.pravatar.cc/150?u=siddharth",
          status: "Remote",
        }
      ]
    }
  ]
};
