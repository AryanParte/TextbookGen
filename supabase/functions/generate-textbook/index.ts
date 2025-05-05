
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = "https://ehxxafnabhdmuottdgah.supabase.co";
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

// Utility function to retry API calls with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  let lastError;
  let delay = 1000; // Start with 1 second delay

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        console.log(`Attempt ${attempt + 1} failed with status: ${response.status}`);
        
        // If we get rate limited, wait according to retry-after header or use exponential backoff
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          delay = retryAfter ? parseInt(retryAfter) * 1000 : delay * 2;
          console.log(`Rate limited. Waiting for ${delay/1000} seconds before retry.`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      // Validate JSON response before returning
      const responseText = await response.text();
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error("Error parsing response as JSON:", parseError);
        console.log("Response wasn't valid JSON:", responseText.substring(0, 500)); // Log start of response
        throw new Error(`Invalid JSON response: ${parseError.message}`);
      }
    } catch (error) {
      console.error(`Attempt ${attempt + 1} error:`, error);
      lastError = error;
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
  
  throw lastError || new Error('Maximum retry attempts reached');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 204
    });
  }

  try {
    const { prompt, chapterCount = 3 } = await req.json();
    console.log(`Received prompt: ${prompt}, chapter count: ${chapterCount}`);

    if (!openAIApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    console.log("Generating textbook outline...");
    const outlineData = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert textbook creator. Create a detailed outline for a textbook with exactly ${chapterCount} chapters based on the user's prompt. Each chapter should have NO MORE THAN 5 sections. Format the response as JSON with the following structure: { title: string, description: string, chapters: Array<{ title: string, sections: Array<{ title: string }> }> }`,
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!outlineData.choices || outlineData.choices.length === 0) {
      console.error('OpenAI API error:', outlineData);
      throw new Error('Failed to generate outline from OpenAI');
    }
    
    console.log("Parsing outline...");
    let outline;
    try {
      // First ensure we have JSON content from the choices
      const content = outlineData.choices[0].message.content;
      // Look for JSON content in the message (might be wrapped in ```json or other markdown)
      const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || [null, content];
      outline = JSON.parse(jsonMatch[1]);

      // Validate the structure
      if (!outline.title || !Array.isArray(outline.chapters)) {
        throw new Error('Invalid outline structure');
      }

      // Ensure we have the exact number of chapters requested
      if (outline.chapters.length !== chapterCount) {
        console.log(`Warning: Generated ${outline.chapters.length} chapters, but ${chapterCount} were requested.`);
        // If we have too many chapters, trim the list
        if (outline.chapters.length > chapterCount) {
          outline.chapters = outline.chapters.slice(0, chapterCount);
        }
        // If we have too few chapters, we'll work with what we have rather than failing
      }

      // Ensure each chapter has no more than 5 sections
      outline.chapters = outline.chapters.map(chapter => {
        if (!Array.isArray(chapter.sections)) {
          chapter.sections = [];
        }
        return {
          ...chapter,
          sections: chapter.sections.slice(0, 5)
        };
      });
    } catch (error) {
      console.error('Error parsing outline JSON:', error);
      console.log('Raw content:', outlineData.choices[0].message.content);
      throw new Error('Failed to parse outline JSON');
    }

    // Create a Supabase client
    console.log("Creating Supabase client...");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate total sections for tracking progress
    const totalSections = outline.chapters.reduce((total, chapter) => 
      total + chapter.sections.length, 0);
    let completedSections = 0;

    // Store the textbook
    console.log("Storing textbook in database...");
    const { data: textbook, error: textbookError } = await supabase
      .from('textbooks')
      .insert({
        title: outline.title,
        description: outline.description || '',
        prompt: prompt,
        status: 'generating',
        completion_percentage: 0,
        total_sections: totalSections
      })
      .select()
      .single();

    if (textbookError) {
      console.error('Supabase textbook insert error:', textbookError);
      throw textbookError;
    }

    console.log(`Textbook created with ID: ${textbook.id}`);
    console.log(`Will generate ${outline.chapters.length} chapters with a total of ${totalSections} sections`);
    
    // Return the textbook ID immediately
    const response = new Response(
      JSON.stringify({ 
        success: true,
        textbookId: textbook.id 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
    
    // Use EdgeRuntime.waitUntil to continue processing in the background
    const generateContent = async () => {
      try {
        // Store chapters and generate content for each section
        for (let chapterIndex = 0; chapterIndex < outline.chapters.length; chapterIndex++) {
          const chapter = outline.chapters[chapterIndex];
          console.log(`Processing chapter ${chapterIndex + 1}/${outline.chapters.length}: ${chapter.title}`);
          
          // Store chapter
          const { data: chapterData, error: chapterError } = await supabase
            .from('chapters')
            .insert({
              textbook_id: textbook.id,
              title: chapter.title,
              position: chapterIndex,
            })
            .select()
            .single();

          if (chapterError) {
            console.error('Supabase chapter insert error:', chapterError);
            // Continue with other chapters even if this one fails
            continue;
          }

          console.log(`Chapter created with ID: ${chapterData.id}`);

          // Generate and store sections
          const limitedSections = chapter.sections.slice(0, 5); // Ensure max 5 sections
          for (let sectionIndex = 0; sectionIndex < limitedSections.length; sectionIndex++) {
            const section = limitedSections[sectionIndex];
            console.log(`Processing section ${sectionIndex + 1}/${limitedSections.length}: ${section.title}`);
            
            // Add delay between API calls to prevent rate limiting
            if (sectionIndex > 0 || chapterIndex > 0) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
            }
            
            // Update textbook with current progress information
            await supabase
              .from('textbooks')
              .update({
                status: 'generating',
                completion_percentage: Math.round((completedSections / totalSections) * 100)
              })
              .eq('id', textbook.id);
            
            let content = "";
            try {
              // Generate section content with retry logic
              const contentData = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openAIApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'gpt-4o',
                  messages: [
                    {
                      role: 'system',
                      content: `You are writing content for a textbook section. The textbook is about: ${outline.title}. The current chapter is: ${chapter.title}. Write comprehensive, well-structured content for the section.`,
                    },
                    { role: 'user', content: `Write the content for the section: ${section.title}` },
                  ],
                }),
              });

              if (contentData.choices && contentData.choices.length > 0) {
                content = contentData.choices[0].message.content;
              } else {
                console.error('Invalid content data structure:', contentData);
                content = `Content generation failed for this section. Please try regenerating.`;
              }
            } catch (error) {
              console.error(`Error generating section content for ${section.title}:`, error);
              content = `Error generating content: ${error.message}. Please try regenerating this section.`;
              // Continue with other sections even if this one fails
            }

            try {
              // Store section
              const { error: sectionError } = await supabase
                .from('sections')
                .insert({
                  chapter_id: chapterData.id,
                  title: section.title,
                  content: content,
                  position: sectionIndex,
                });

              if (sectionError) {
                console.error('Supabase section insert error:', sectionError);
                // Continue with other sections even if this one fails
              }

              // Update progress after each section is completed
              completedSections++;
              const completionPercentage = Math.round((completedSections / totalSections) * 100);
              
              // Update textbook with new completion percentage
              await supabase
                .from('textbooks')
                .update({ 
                  completion_percentage: completionPercentage,
                  status: completedSections === totalSections ? 'completed' : 'generating'
                })
                .eq('id', textbook.id);

              console.log(`Section ${sectionIndex + 1} created successfully. Completion: ${completionPercentage}%`);
            } catch (sectionError) {
              console.error('Error storing section:', sectionError);
              // Continue with other sections even if this one fails
            }
          }
        }
        
        // Final update - ensure the textbook is marked as completed
        await supabase
          .from('textbooks')
          .update({ 
            completion_percentage: 100,
            status: 'completed'
          })
          .eq('id', textbook.id);
        
        console.log("Textbook generation completed successfully");
      } catch (error) {
        console.error("Error in background processing:", error);
        
        // Update textbook with error status
        await supabase
          .from('textbooks')
          .update({ 
            status: 'error'
          })
          .eq('id', textbook.id);
      }
    };
    
    if (typeof EdgeRuntime !== 'undefined') {
      EdgeRuntime.waitUntil(generateContent());
    } else {
      // For local development fallback
      generateContent();
    }
    
    return response;

  } catch (error) {
    console.error('Error in generate-textbook function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unknown error occurred',
        success: false 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
