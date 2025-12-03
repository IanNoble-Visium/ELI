import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Camera, MapPin, Activity, TrendingUp, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";

// List of Peru-themed b-roll videos
const VIDEO_FILES = [
  "/videos/2_an_aerial_202512030350_431lr.mp4",
  "/videos/11_a_hyperrealistic_202512030351_sif3j.mp4",
  "/videos/12_a_cinematic_202512030351_7xkq5.mp4",
  "/videos/13_an_aerial_202512030351_fhfi4.mp4",
  "/videos/15_a_highaltitude_202512030351_z1b56.mp4",
  "/videos/17_a_cinematic_202512030351_vc7mw.mp4",
  "/videos/18_an_aerial_202512030351_v3zb3.mp4",
  "/videos/20_a_hyperrealistic_202512030351_hsxbr.mp4",
  "/videos/21_a_subtle_202512030351_0w7x8.mp4",
  "/videos/26_a_cinematic_202512030351_siwtx.mp4",
  "/videos/30_an_aerial_202512030351_wihjp.mp4",
  "/videos/34_a_cinematic_202512030352_562ir.mp4",
  "/videos/36_an_aerial_202512030352_p7z3d.mp4",
  "/videos/40_a_cinematic_202512030352_amzue.mp4",
  "/videos/43_a_drone_202512030352_eopwh.mp4",
  "/videos/46_a_cinematic_202512030352_hz972.mp4",
  "/videos/50_a_final_202512030352_yw2e5.mp4",
];

// Shuffle array helper
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [shuffledVideos, setShuffledVideos] = useState<string[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize shuffled videos
  useEffect(() => {
    setShuffledVideos(shuffleArray(VIDEO_FILES));
  }, []);

  // Handle video end - transition to next video
  const handleVideoEnd = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentVideoIndex((prev) => (prev + 1) % shuffledVideos.length);
      setIsTransitioning(false);
    }, 1000);
  }, [shuffledVideos.length]);

  // Handle video error - skip to next video
  const handleVideoError = useCallback(() => {
    console.warn("Video failed to load, skipping to next");
    setCurrentVideoIndex((prev) => (prev + 1) % shuffledVideos.length);
  }, [shuffledVideos.length]);

  const stats = [
    { icon: Camera, label: "Cameras", value: "3,084", color: "text-primary" },
    { icon: MapPin, label: "Regions", value: "25", color: "text-primary" },
    { icon: Users, label: "Police Stations", value: "107", color: "text-primary" },
    { icon: Activity, label: "Real-time Events", value: "Live", color: "text-green-500" },
  ];

  const features = [
    {
      icon: Shield,
      title: "Advanced Surveillance",
      description: "Real-time monitoring across Peru's national infrastructure with AI-powered threat detection.",
    },
    {
      icon: TrendingUp,
      title: "Predictive Analytics",
      description: "Machine learning algorithms forecast patterns and identify anomalies before they escalate.",
    },
    {
      icon: MapPin,
      title: "Geographic Intelligence",
      description: "Interactive mapping with 3,084 cameras covering 25 regions and 107 police stations.",
    },
    {
      icon: Activity,
      title: "Incident Management",
      description: "Comprehensive incident tracking with video evidence and automated response coordination.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Video Background with Transitions */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {shuffledVideos.length > 0 && (
            <motion.div
              key={currentVideoIndex}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: isTransitioning ? 0 : 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <video
                ref={videoRef}
                key={shuffledVideos[currentVideoIndex]}
                className="absolute w-full h-full object-cover"
                autoPlay
                muted
                playsInline
                onEnded={handleVideoEnd}
                onError={handleVideoError}
              >
                <source src={shuffledVideos[currentVideoIndex]} type="video/mp4" />
              </video>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/90" />
        
        {/* Animated grid pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(217, 16, 35, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(217, 16, 35, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }} />
        </div>
      </div>
      
      {/* Peru flag accent */}
      <div className="fixed top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-white to-primary z-20" />
      
      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="container max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-8"
          >
            {/* Logo/Shield with glow effect */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="mx-auto w-28 h-28 bg-primary/20 rounded-full flex items-center justify-center mb-8 ring-4 ring-primary/30 shadow-lg shadow-primary/20"
            >
              <Shield className="w-14 h-14 text-primary drop-shadow-lg" />
            </motion.div>
            
            <motion.h1 
              className="text-5xl md:text-7xl font-bold tracking-tight text-white drop-shadow-2xl"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              ELI Dashboard
            </motion.h1>
            
            <motion.p 
              className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto drop-shadow-lg font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              Peru's National Surveillance & Intelligence Platform
            </motion.p>
            
            {/* Animated Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.15, duration: 0.6 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <Card className="bg-card/70 backdrop-blur-md border-border/40 hover:border-primary/60 transition-all duration-300 shadow-xl shadow-black/20 hover:shadow-primary/20">
                    <CardContent className="p-6 text-center space-y-2">
                      <stat.icon className={`w-10 h-10 mx-auto ${stat.color} drop-shadow-md`} />
                      <motion.div 
                        className="text-4xl font-bold text-white drop-shadow-sm"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.9 + index * 0.15, duration: 0.4, type: "spring" }}
                      >
                        {stat.value}
                      </motion.div>
                      <div className="text-sm text-white/70 font-medium uppercase tracking-wider">{stat.label}</div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
            
            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              className="pt-12"
            >
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-16 py-7 h-auto font-semibold shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 hover:scale-105 ring-2 ring-white/20"
                onClick={() => setLocation("/login")}
              >
                Enter Dashboard
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="relative z-10 py-24 px-4 bg-background/80 backdrop-blur-lg border-t border-border/30">
        <div className="container max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4 text-white">Platform Capabilities</h2>
            <p className="text-xl text-white/70">
              Comprehensive surveillance and analytics for national security
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ y: -8, scale: 1.02 }}
              >
                <Card className="h-full bg-card/60 backdrop-blur-md border-border/40 hover:border-primary/60 transition-all duration-300 shadow-xl hover:shadow-primary/20 group">
                  <CardContent className="p-6 space-y-4">
                    <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center group-hover:bg-primary/30 transition-colors duration-300 ring-2 ring-primary/20">
                      <feature.icon className="w-7 h-7 text-primary drop-shadow-sm" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                    <p className="text-white/60 leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="relative z-10 py-8 text-center text-sm border-t border-border/30 bg-background/60 backdrop-blur-sm">
        <div className="container">
          <p className="text-white/70">Sistema de Vigilancia Nacional del Perú</p>
          <p className="mt-2 text-white/50">Powered by TruContext Intelligence Platform</p>
        </div>
      </footer>
    </div>
  );
}
