"use client"
import { Button } from "./ui/button"
import Link from "next/link"
import {useMediaQuery} from "react-responsive"

const HomepageButtons = () => {

  const isMobile = useMediaQuery({ query: "(max-width: 640px)" })

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Button asChild size={isMobile ? "sm" : "lg"} className="h-11 flex-1 md:flex-auto px-4 sm:max-w-[170px] rounded-md border border-[#373637]/20 bg-[#111217] text-white hover:bg-[#23252d] dark:border-white/15 dark:bg-[#111217]">
        <Link href="/wiki">Browse Wiki</Link>
      </Button>
      <Button asChild size={isMobile ? "sm" : "lg"} className="h-11 flex-1 md:flex-auto px-4 sm:max-w-[170px] rounded-md bg-[#2CAD9E] text-white hover:bg-[#26998d]">
        <Link href="/posts">Browse Articles</Link>
      </Button>
      <Button asChild variant="outline" size={isMobile ? "sm" : "lg"} className="h-11 flex-1 md:flex-auto px-4 sm:max-w-[170px] rounded-md border-[#2CAD9E]/50 bg-transparent text-[#111217] hover:bg-[#2CAD9E]/12 hover:text-[#111217] dark:border-[#2CAD9E]/60 dark:text-white dark:hover:bg-[#2CAD9E]/15 dark:hover:text-white">
        <Link href="/cs-study-plan">Courses Info</Link>
      </Button>
    </div>
  )
}

export default HomepageButtons