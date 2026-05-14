const WRITING_SAMPLES = {
  test14: {
    part1: {
      title: "Question 1: Email to Lisa",
      task: "Reply to the email using all the notes provided.",
      answer: [
        "Hi Lisa,",
        "",
        "Thanks for your email! It's great to hear from you. My studies are going great at the moment; I've just finished a big project, so I'm feeling quite relieved.",
        "",
        "Regarding the film night this Saturday, you can decide what we watch! I enjoy almost any genre, so I'm sure I'll like your choice. To help out with the party, I will bring some homemade popcorn and a few bottles of soda.",
        "",
        "As for the time, starting at 6.00 is perfectly fine for me. It gives us plenty of time to chat before the movie starts.",
        "",
        "See you then!"
      ].join("\n")
    },
    part2: {
      title: "Question 2: Magazine Article",
      task: "Write an article about the kind of holiday you enjoy.",
      heading: "The Perfect Escape",
      answer: [
        "When it comes to holidays, I definitely prefer exploring coastal cities rather than staying in the countryside. My favorite place to visit is Da Nang, because it offers a wonderful mix of beautiful beaches and modern urban life.",
        "",
        "There are so many things I like to do there. Usually, I spend my mornings swimming or sunbathing by the sea. In the evenings, I love walking across the illuminated bridges and trying local street food. For me, the best holiday involves a balance of relaxation and discovering new flavors. It's the perfect way to recharge!"
      ].join("\n")
    },
    part3: {
      title: "Question 3: Story",
      task: "Start with the given sentence.",
      answer: [
        "When I opened the door, I couldn't believe my eyes. The living room, which I had left in a complete mess this morning, was now absolutely spotless. Not only was the floor shining, but there was also a massive chocolate cake sitting on the dining table with a note next to it.",
        "",
        "I walked over and read the message: \"Happy Birthday! We wanted to surprise you.\" Suddenly, my friends jumped out from behind the sofa, shouting and cheering. I had completely forgotten it was my birthday because I had been so busy with work. It was the best surprise ever!"
      ].join("\n")
    }
  }
};

if (typeof window !== "undefined") {
  window.WRITING_SAMPLES = WRITING_SAMPLES;
}

export default WRITING_SAMPLES;