<?xml version="1.0"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:d="http://docbook.org/ns/docbook"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns="http://www.w3.org/1999/xhtml"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"  
  exclude-result-prefixes="d xlink"
  version="1.0">
  
<!-- ====================== -->
<!--        Root            -->
<!-- ====================== -->
<xsl:template match="/">
  <html
    prefix="schema: http://schema.org/ prism: http://prismstandard.org/namespaces/basic/2.0/ dcterms: http://purl.org/dc/terms/">
    <head>
      <title property="dcterms:title"><xsl:apply-templates select="//header/h1/text()"/></title>
    </head>
    <xsl:apply-templates select=".//body"/>
  </html>
</xsl:template> 
  
  <!-- ======================================= -->
  <!--              Header eliminato      -->
  <!-- ======================================= --> 
  <xsl:template match="header"/>
  
  
  <!-- ======================================= -->
  <!--              Header eliminato      -->
  <!-- ======================================= --> 
  <xsl:template match="section[@class='level1'][position()=1]">
    <section role="doc-abstract">
      <h1>Abstract</h1>
      <xsl:apply-templates select=".//blockquote/p"/>
    </section>
  </xsl:template>
  
  
  
  
  

  <!-- ======================================= -->
  <!--             H2, ...., H6           -->
  <!-- ======================================= --> 
  <xsl:template match="h2">
    <h1>
      <xsl:apply-templates/>
    </h1>
  </xsl:template>
  
  
  <!-- ======================================= -->
  <!--                  Tabelle                -->
  <!-- ======================================= --> 
  
  <xsl:template match="table">
    <!-- TODO. Gestire ID -->
    <figure>
      <table>
        <xsl:apply-templates select="@* | * "/>
      </table>
      <figcaption>Table. <!-- TODO. Caption --></figcaption>
    </figure>
  </xsl:template>
  
  
  <xsl:template match="td[not(p)]">
    <td>
      <xsl:apply-templates select="@*"/>
      <p>
        <xsl:apply-templates select="* | text() | comment()"/>
      </p>
    </td>
  </xsl:template>
  
  
  <!-- ======================================= -->
  <!--                Footnotes                -->
  <!-- ======================================= --> 
  <xsl:template match="section[@class='footnotes']">
    <section role="doc-endnotes">
      <xsl:apply-templates select="@*"/>
      <xsl:apply-templates select=".//li"/>
    </section>
  </xsl:template> 
  
  <xsl:template match="li[@role = 'doc-endnote']">
    <section role="doc-endnote">
      <xsl:apply-templates select="@*"/>
      <xsl:apply-templates select="* | comment()"/>
    </section>
  </xsl:template> 
        
     
     
  <!-- =============================================== -->
  <!--            Definition list (DL, DT, DD)         -->
  <!--        TODO: da sistemare, non previsto in RASH -->
  <!-- =============================================== --> 
  <xsl:template match="dl">
    <figure>
    <table class="dl">
      <xsl:apply-templates/>
    </table>
      <figcaption>Definition List. <!-- TODO. Caption in Definition List --></figcaption>
    </figure>
  </xsl:template>

  <xsl:template match="dt">
    <tr  class="dt">
      <td>
        <p>
          <xsl:apply-templates/>
        </p>
      </td>
    </tr>
  </xsl:template>  

  <xsl:template match="dd">
    <tr  class="dd">
      <td>
          <xsl:apply-templates/>
      </td>
    </tr>
  </xsl:template>  
  
  
  <!-- ======================================= -->
  <!--             Bibliografia                -->
  <!-- ======================================= --> 
  
  <xsl:template match="section[@class='level1'][following-sibling::*[1][@class='footnotes']] [contains(.//h1/text(),'ibliography') or contains(.//h1/text(),'eferences') ]">
    <section class="bibliography">
      <xsl:apply-templates select="h1"/>
      <ul>
        <xsl:apply-templates select="section" mode="biblio"/>
      </ul>
    </section>
  </xsl:template>
  
  <xsl:template match="section[@class='level2']" mode="biblio">
    <li>
      <p class="bibliomixed">
        <xsl:apply-templates mode="biblio"/>
      </p>
    </li>
  </xsl:template>
  

  <!-- ======================================= -->
  <!--          Emphasis/Italic                -->
  <!-- ======================================= --> 
  <xsl:template match="i | span[contains(@class,'ital')]">
    <em>
      <xsl:apply-templates select="* | @*[not(contains(name(),'class'))] | text() | comment()"/>
    </em>
  </xsl:template>
 
 
  <!-- ======================================= -->
  <!--       Elementi da ignorare 
        (ma processando il contenuto)          -->
  <!-- ======================================= --> 
  <xsl:template match="tbody | thead | hr">
    <xsl:apply-templates/>
  </xsl:template>
  

  <!-- ======================================= -->
  <!--                   @role                 -->
  <!-- ======================================= -->
  <xsl:template match="@role"/>
 
   
<!-- =================================  -->
<!--            identity                -->
<!-- =================================  -->    
  
  <xsl:template match="*">
    <xsl:element name="{name()}">
      <xsl:apply-templates select="* | @* | text() | comment()"/>
    </xsl:element>
  </xsl:template>  
  
<xsl:template match="@* | text() | comment()">
  <xsl:copy>
     <xsl:apply-templates select="text() | comment()"/>
  </xsl:copy>
</xsl:template>
  
</xsl:stylesheet>
