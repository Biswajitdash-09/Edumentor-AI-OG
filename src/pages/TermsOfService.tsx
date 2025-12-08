import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>

        <h1 className="text-4xl font-bold text-foreground mb-8">Terms of Service</h1>
        
        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing and using EduMentor AI, you accept and agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground">
              EduMentor AI is an educational management platform that provides tools for course management, 
              attendance tracking, assignment submission, grading, and AI-powered mentoring assistance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">3. User Accounts</h2>
            <p className="text-muted-foreground">
              You are responsible for maintaining the confidentiality of your account credentials and for all 
              activities that occur under your account. You must immediately notify us of any unauthorized use 
              of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">4. Acceptable Use</h2>
            <p className="text-muted-foreground">You agree not to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
              <li>Use the service for any unlawful purpose</li>
              <li>Submit false or misleading information</li>
              <li>Attempt to gain unauthorized access to other user accounts</li>
              <li>Interfere with the proper functioning of the platform</li>
              <li>Upload malicious content or software</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">5. Intellectual Property</h2>
            <p className="text-muted-foreground">
              All content on EduMentor AI, including but not limited to text, graphics, logos, and software, 
              is the property of EduMentor AI or its content suppliers and is protected by intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">6. Privacy</h2>
            <p className="text-muted-foreground">
              Your use of EduMentor AI is also governed by our Privacy Policy. Please review our 
              <Link to="/privacy" className="text-primary hover:underline ml-1">Privacy Policy</Link> 
              to understand our practices.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">7. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              EduMentor AI shall not be liable for any indirect, incidental, special, consequential, or 
              punitive damages resulting from your use of or inability to use the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">8. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these terms at any time. We will notify users of any material 
              changes via email or through the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">9. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about these Terms of Service, please contact us at support@edumentor.ai
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
