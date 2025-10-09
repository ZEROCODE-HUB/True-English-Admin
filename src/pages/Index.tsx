import { useState } from "react";
import LoginPage from "@/components/LoginPage";
import AdminLayout from "@/components/AdminLayout";
import Dashboard from "@/components/Dashboard";
import UserManagement from "@/components/UserManagement";
import CourseManagement from "@/components/CourseManagement";
import QuizManagement from "@/components/QuizManagement";
import ConversationManagement from "@/components/ConversationManagement";

const Index = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState("dashboard");

  const handleLogin = () => setIsLoggedIn(true);
  const handleLogout = () => setIsLoggedIn(false);

  const renderContent = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "users":
        return <UserManagement />;
      case "courses":
        return <CourseManagement />;
      case "quizzes":
        return <QuizManagement />;
      case "conversations":
        return <ConversationManagement />;
      default:
        return <Dashboard />;
    }
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AdminLayout 
      currentPage={currentPage}
      onPageChange={setCurrentPage}
      onLogout={handleLogout}
    >
      {renderContent()}
    </AdminLayout>
  );
};

export default Index;
