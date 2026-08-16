import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Quote, Star, MessageSquarePlus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPublicApprovedTestimonials } from "@/lib/account.functions";
import { useAuth } from "@/lib/auth-context";
import { TestimonialsSkeleton } from "@/components/ui/skeleton-loaders";

const defaultTestimonials = [
  {
    id: "dt-1",
    author_name: "Wanjiku M.",
    role: "Market Vendor, Nairobi",
    rating: 5,
    content:
      "I received my stock loan in under 10 minutes directly to my M-Pesa. No physical paperwork or long queues. Highly reliable service!",
  },
  {
    id: "dt-2",
    author_name: "Ochieng K.",
    role: "Boda Boda Operator, Kisumu",
    rating: 5,
    content:
      "My two guarantors confirmed my application on their phones, and my motorcycle repair loan was disbursed instantly over M-Pesa. Repaying with STK Push is seamless.",
  },
  {
    id: "dt-3",
    author_name: "Amina H.",
    role: "Boutique Owner, Mombasa",
    rating: 5,
    content:
      "After three on-time repayments, my credibility score increased and unlocked the Silver Tier limit. This app helped me double my shop's inventory.",
  },
  {
    id: "dt-4",
    author_name: "David N.",
    role: "Hardware Supplier, Nakuru",
    rating: 5,
    content:
      "The automatic repayment schedules and clear fee breakdown give me complete peace of mind. Transparent interest rates with zero hidden charges.",
  },
  {
    id: "dt-5",
    author_name: "Grace W.",
    role: "Agro-dealer, Eldoret",
    rating: 5,
    content:
      "I invited my business partners as guarantors. The entire approval process took less than an hour. Best lending platform in Kenya!",
  },
];

export function TestimonialsCarousel() {
  const { session } = useAuth();
  const getTestimonialsFn = useServerFn(getPublicApprovedTestimonials);

  const { data: realTestimonials, isLoading } = useQuery({
    queryKey: ["public-testimonials"],
    queryFn: () => getTestimonialsFn(),
    staleTime: 60 * 1000,
  });

  const testimonials =
    realTestimonials && realTestimonials.length > 0 ? realTestimonials : defaultTestimonials;

  if (isLoading) {
    return <TestimonialsSkeleton />;
  }

  return (
    <div className="relative">
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4 py-2">
          {testimonials.map(
            (
              t: {
                id: string | undefined;
                rating: number | undefined;
                content: string;
                author_name: string | undefined;
                role: string | undefined;
              },
              index: number,
            ) => (
              <CarouselItem
                key={t.id || index}
                className="pl-2 md:pl-4 sm:basis-1/2 lg:basis-1/3 flex"
              >
                <Card className="h-full w-full border-border/70 bg-gradient-surface flex flex-col justify-between">
                  <CardContent className="p-6 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-gold">
                          {Array.from({ length: t.rating || 5 }).map((_, i) => (
                            <Star key={i} className="size-4 fill-gold text-gold" aria-hidden />
                          ))}
                        </div>
                        <Quote className="size-6 text-primary/20" aria-hidden />
                      </div>

                      <p className="mt-4 text-sm leading-relaxed text-foreground/90 font-sans line-clamp-5">
                        "{t.content}"
                      </p>
                    </div>

                    <div className="mt-6 flex items-center gap-3 border-t border-border/50 pt-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-sm font-semibold text-primary-foreground shadow-sm">
                        {t.author_name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{t.author_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            ),
          )}
        </CarouselContent>

        <div className="flex items-center justify-center gap-4 mt-8">
          <CarouselPrevious className="static translate-y-0 h-9 w-9 bg-background border-border/80 text-foreground hover:bg-muted" />
          <CarouselNext className="static translate-y-0 h-9 w-9 bg-background border-border/80 text-foreground hover:bg-muted" />
        </div>
      </Carousel>

      {session && (
        <div className="mt-6 text-center">
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link to="/account">
              <MessageSquarePlus className="size-4 text-primary" />
              Share your own experience
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
